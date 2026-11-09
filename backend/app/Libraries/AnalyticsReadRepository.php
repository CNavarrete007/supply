<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * SupplyFlow v0.6: read-only measures at REQUISITION grain.
 * Multiple documented milestones are NOT mutually exclusive workflow stages.
 * Monetary amounts are never merged across currencies; PO and customer quote
 * monetary aggregates use only the latest version in each series.
 */
final class AnalyticsReadRepository
{
    private BaseConnection $db;

    public function __construct(?BaseConnection $connection = null)
    {
        $this->db = $connection ?? Database::connect();
        $this->db->initialize();
    }

    private function rows(string $sql, array $binds = []): array
    {
        $result = $this->db->query($sql, $binds);
        if ($result === false) {
            throw new RuntimeException('ANALYTICS_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    private function one(string $sql, array $binds = []): array
    {
        return $this->rows($sql, $binds)[0] ?? [];
    }

    private static function baseFrom(): string
    {
        return ' FROM requisitions r'
            . " JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id AND e.entity_kind='requisition'"
            . ' JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id'
            . " JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'";
    }

    private static function scope(int $organizationId, array $filter, bool $withSearch = false): array
    {
        $conditions = ['r.organization_id=?'];
        $binds = [$organizationId];
        if (($filter['from'] ?? '') !== '') {
            $conditions[] = 'r.request_date>=?';
            $binds[] = $filter['from'];
        }
        if (($filter['to'] ?? '') !== '') {
            $conditions[] = 'r.request_date<=?';
            $binds[] = $filter['to'];
        }
        if (($filter['client'] ?? 'all') !== 'all') {
            $conditions[] = 'ce.public_id=?';
            $binds[] = $filter['client'];
        }
        if ($withSearch && ($filter['q'] ?? '') !== '') {
            $fields = ['r.folio', 'r.description', 'c.legal_name', 'r.requester_name', 'r.project_reference_snapshot', 'r.internal_reference'];
            $conditions[] = '(' . implode(' OR ', array_map(static fn ($f) => $f . " LIKE ? ESCAPE '!'", $fields)) . ')';
            $pattern = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $filter['q']) . '%';
            foreach ($fields as $_) {
                $binds[] = $pattern;
            }
        }
        $milestone = $withSearch ? ($filter['has'] ?? 'all') : 'all';
        if ($milestone !== 'all') {
            $exists = self::milestoneExists($milestone === 'without_purchase_order' ? 'purchase_order' : $milestone);
            $conditions[] = ($milestone === 'without_purchase_order' ? 'NOT ' : '') . $exists;
        }
        return [implode(' AND ', $conditions), $binds];
    }

    /** Hardcoded allowlist: never construct a SQL identifier from untrusted query params. */
    private static function milestoneExists(string $kind): string
    {
        $rules = [
            'rfq' => 'EXISTS (SELECT 1 FROM rfqs f WHERE f.organization_id=r.organization_id AND f.requisition_id=r.id)',
            'supplier_quote' => 'EXISTS (SELECT 1 FROM supplier_quotes sq WHERE sq.organization_id=r.organization_id AND sq.requisition_id=r.id)',
            'customer_quote' => 'EXISTS (SELECT 1 FROM customer_quote_versions qv WHERE qv.organization_id=r.organization_id AND qv.requisition_id=r.id)',
            'purchase_order' => 'EXISTS (SELECT 1 FROM purchase_order_requisitions pr WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id)',
            'receipt' => 'EXISTS (SELECT 1 FROM purchase_order_requisitions pr JOIN goods_receipts gr ON gr.organization_id=pr.organization_id AND gr.purchase_order_id=pr.purchase_order_id WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id)',
            'delivery' => 'EXISTS (SELECT 1 FROM delivery_items di WHERE di.organization_id=r.organization_id AND di.requisition_id=r.id)',
            'invoice' => 'EXISTS (SELECT 1 FROM invoices inv WHERE inv.organization_id=r.organization_id AND inv.requisition_id=r.id)',
        ];
        if (!isset($rules[$kind])) {
            throw new RuntimeException('ANALYTICS_FILTER_UNKNOWN');
        }
        return $rules[$kind];
    }

    private static function intFields(array $row): array
    {
        foreach ($row as $key => $value) {
            if (in_array($key, ['total', 'undated', 'with_rfq', 'with_supplier_quote', 'with_customer_quote',
                'with_purchase_order', 'with_receipt', 'with_delivery', 'with_invoice',
                'requisitions', 'documents', 'line_count', 'rfq_count', 'supplier_quote_count',
                'customer_quote_count', 'purchase_order_count', 'receipt_count', 'delivery_count',
                'invoice_count'], true)) {
                $row[$key] = (int) $value;
            }
        }
        return $row;
    }

    /** Client picker deliberately includes all clients, even those with no requisitions. */
    public function clients(int $org): array
    {
        return $this->rows(<<<'SQL'
            SELECT ce.public_id AS id,c.code,c.legal_name AS name
            FROM clients c
            JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'
            WHERE c.organization_id=? ORDER BY c.legal_name,c.id
            SQL, [$org]);
    }

    public function overview(int $org, array $filter): array
    {
        [$where, $binds] = self::scope($org, $filter);
        $from = self::baseFrom();
        $columns = ['COUNT(*) AS total',
            'COALESCE(SUM(CASE WHEN r.request_date IS NULL THEN 1 ELSE 0 END),0) AS undated'];
        foreach (['rfq','supplier_quote','customer_quote','purchase_order','receipt','delivery','invoice'] as $kind) {
            $columns[] = 'COALESCE(SUM(CASE WHEN ' . self::milestoneExists($kind)
                . ' THEN 1 ELSE 0 END),0) AS with_' . $kind;
        }
        $summary = self::intFields($this->one('SELECT ' . implode(',', $columns) . $from . ' WHERE ' . $where, $binds));
        $monthly = $this->rows('SELECT DATE_FORMAT(r.request_date,\'%Y-%m\') AS period,COUNT(*) AS requisitions'
            . $from . ' WHERE ' . $where . ' AND r.request_date IS NOT NULL'
            . ' GROUP BY DATE_FORMAT(r.request_date,\'%Y-%m\') ORDER BY period DESC LIMIT 24', $binds);
        $monthly = array_reverse(array_map([self::class,'intFields'], $monthly));
        $topClients = array_map([self::class,'intFields'], $this->rows(
            'SELECT ce.public_id AS id,c.legal_name AS name,COUNT(*) AS requisitions'
            . $from . ' WHERE ' . $where . ' GROUP BY ce.public_id,c.legal_name'
            . ' ORDER BY requisitions DESC,c.legal_name LIMIT 8', $binds));
        // A document can relate to more than one requisition. EXISTS avoids multiplying its value.
        $po = $this->moneyByCurrency($org, $where, $binds, 'purchase_orders');
        $quotes = $this->moneyByCurrency($org, $where, $binds, 'customer_quote_versions');
        $budgets = $this->rows('SELECT r.currency_code,COUNT(*) AS documents,'
            . ' COALESCE(SUM(r.budget_amount),0) AS amount'
            . $from . ' WHERE ' . $where . ' AND r.budget_amount IS NOT NULL'
            . ' GROUP BY r.currency_code ORDER BY r.currency_code', $binds);
        $budgets = array_map([self::class,'intFields'], $budgets);
        return [
            'source' => 'mariadb',
            'filters' => $filter,
            'summary' => $summary,
            'monthly' => $monthly,
            'top_clients' => $topClients,
            'financial' => ['requisition_budgets' => $budgets, 'purchase_orders' => $po, 'customer_quotes' => $quotes],
            'catalogs' => [
                'clients' => (int) ($this->one('SELECT COUNT(*) AS total FROM clients WHERE organization_id=?', [$org])['total'] ?? 0),
                'suppliers' => (int) ($this->one('SELECT COUNT(*) AS total FROM suppliers WHERE organization_id=?', [$org])['total'] ?? 0),
            ],
            'definitions' => [
                'date_basis' => 'Fecha de solicitud (requisitions.request_date); sin fecha queda fuera si se filtra por periodo.',
                'document_grain' => 'Hitos: cantidad de requisiciones con al menos un documento vinculado; no son etapas exclusivas ni documentos totales.',
                'money_basis' => 'Montos guardados, agrupados por moneda. Cotización/OC: última versión de cada serie, contada una sola vez; no son pagos ni ahorro comprobado.',
                'coverage' => 'Documentos retenidos en conciliación sin relación válida no se presentan como vinculados.',
                'trend' => 'Hasta 24 meses con fechas registradas; no se rellenan periodos sin registros.',
            ],
        ];
    }

    private function moneyByCurrency(int $org, string $where, array $binds, string $kind): array
    {
        if ($kind === 'purchase_orders') {
            $sql = 'SELECT po.currency_code,COUNT(*) AS documents,COALESCE(SUM(po.total_amount),0) AS amount'
                . ' FROM purchase_orders po WHERE po.organization_id=?'
                . ' AND NOT EXISTS (SELECT 1 FROM purchase_orders newer WHERE newer.organization_id=po.organization_id'
                . ' AND newer.series_public_id=po.series_public_id AND newer.version_number>po.version_number)'
                . ' AND EXISTS (SELECT 1 FROM purchase_order_requisitions pr'
                . ' JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id'
                . ' JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id'
                . " JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'"
                . ' WHERE pr.purchase_order_id=po.id AND pr.organization_id=po.organization_id AND ' . $where . ')'
                . ' GROUP BY po.currency_code ORDER BY po.currency_code';
        } elseif ($kind === 'customer_quote_versions') {
            $sql = 'SELECT qv.currency_code,COUNT(*) AS documents,COALESCE(SUM(qv.total_amount),0) AS amount'
                . ' FROM customer_quote_versions qv WHERE qv.organization_id=?'
                . ' AND NOT EXISTS (SELECT 1 FROM customer_quote_versions newer WHERE newer.organization_id=qv.organization_id'
                . ' AND newer.customer_quote_id=qv.customer_quote_id AND newer.version_number>qv.version_number)'
                . ' AND EXISTS (SELECT 1 FROM requisitions r'
                . ' JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id'
                . " JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'"
                . ' WHERE r.id=qv.requisition_id AND r.organization_id=qv.organization_id AND ' . $where . ')'
                . ' GROUP BY qv.currency_code ORDER BY qv.currency_code';
        } else {
            throw new RuntimeException('UNKNOWN_MONEY_SOURCE');
        }
        return array_map([self::class,'intFields'], $this->rows($sql, [$org, ...$binds]));
    }

    /** Requisitions grain; one row per request, no multiplication through JOINs. */
    public function report(int $org, array $filter, int $page, int $size): array
    {
        [$where,$binds] = self::scope($org, $filter, true);
        $from = self::baseFrom();
        $columns = ['COUNT(*) AS total'];
        foreach (['rfq','supplier_quote','customer_quote','purchase_order','receipt','delivery','invoice'] as $kind) {
            $columns[] = 'COALESCE(SUM(CASE WHEN ' . self::milestoneExists($kind)
                . ' THEN 1 ELSE 0 END),0) AS with_' . $kind;
        }
        $summary = self::intFields($this->one('SELECT ' . implode(',', $columns) . $from . ' WHERE ' . $where, $binds));
        $total = (int) ($summary['total'] ?? 0);
        $budgets = array_map([self::class, 'intFields'], $this->rows(
            'SELECT r.currency_code,COUNT(*) AS documents,COALESCE(SUM(r.budget_amount),0) AS amount'
            . $from . ' WHERE ' . $where . ' AND r.budget_amount IS NOT NULL'
            . ' GROUP BY r.currency_code ORDER BY r.currency_code', $binds));
        $sql = <<<'SQL'
            SELECT e.public_id AS id,r.folio,c.legal_name AS client_name,
            r.project_reference_snapshot AS project,r.request_date,r.need_date,
            r.currency_code,r.budget_amount,r.description,
            (SELECT COUNT(*) FROM requisition_items li WHERE li.organization_id=r.organization_id AND li.requisition_id=r.id) AS line_count,
            (SELECT COUNT(*) FROM rfqs f WHERE f.organization_id=r.organization_id AND f.requisition_id=r.id) AS rfq_count,
            (SELECT COUNT(*) FROM supplier_quotes sq WHERE sq.organization_id=r.organization_id AND sq.requisition_id=r.id) AS supplier_quote_count,
            (SELECT COUNT(*) FROM customer_quote_versions qv WHERE qv.organization_id=r.organization_id AND qv.requisition_id=r.id) AS customer_quote_count,
            (SELECT COUNT(DISTINCT pr.purchase_order_id) FROM purchase_order_requisitions pr WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id) AS purchase_order_count,
            (SELECT COUNT(DISTINCT gr.id) FROM purchase_order_requisitions pr JOIN goods_receipts gr ON gr.organization_id=pr.organization_id AND gr.purchase_order_id=pr.purchase_order_id WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id) AS receipt_count,
            (SELECT COUNT(DISTINCT di.delivery_id) FROM delivery_items di WHERE di.organization_id=r.organization_id AND di.requisition_id=r.id) AS delivery_count,
            (SELECT COUNT(*) FROM invoices inv WHERE inv.organization_id=r.organization_id AND inv.requisition_id=r.id) AS invoice_count
            SQL;
        $data = $this->rows($sql . $from . ' WHERE ' . $where
            . ' ORDER BY COALESCE(r.request_date,DATE(e.created_at)) DESC,r.id DESC LIMIT ? OFFSET ?',
            [...$binds, $size, ($page - 1) * $size]);
        return [
            'source' => 'mariadb',
            'filters' => $filter,
            'total' => $total,
            'summary' => $summary,
            'budgets' => $budgets,
            'page' => $page,
            'page_size' => $size,
            'items' => array_map([self::class,'intFields'], $data),
            'notes' => [
                'Solo montos presupuestados por requisición; NULL es desconocido, no cero.',
                'Contadores de documentos vinculados, incluyendo revisiones donde existan; no son estados ni certificados de cierre.',
                'No se suman importes de monedas diferentes y no se calculan ahorros sin comparables.',
            ],
        ];
    }
}
