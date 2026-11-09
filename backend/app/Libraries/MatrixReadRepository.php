<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * Read-only evidence matrix. A milestone means a related document exists;
 * it is NOT a validated workflow status or a certificate of completeness.
 * All queries use the existing SELECT-only API account and organization scope.
 */
final class MatrixReadRepository
{
    private BaseConnection $db;

    public function __construct(?BaseConnection $connection = null)
    {
        $this->db = $connection ?? Database::connect();
        $this->db->initialize();
    }

    private function rows(string $sql, array $params = []): array
    {
        $result = $this->db->query($sql, $params);
        if ($result === false) {
            throw new RuntimeException('MATRIX_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    private function one(string $sql, array $params = []): ?array
    {
        $result = $this->db->query($sql, $params);
        if ($result === false) {
            throw new RuntimeException('MATRIX_QUERY_FAILED');
        }
        return $result->getRowArray() ?: null;
    }

    private static function like(string $value): string
    {
        return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $value) . '%';
    }

    /** Server-owned allowlist: never incorporate arbitrary identifiers from query parameters. */
    private static function existsSql(string $document): string
    {
        $rules = [
            'review' => 'EXISTS (SELECT 1 FROM requisition_reviews rv WHERE rv.organization_id=r.organization_id AND rv.requisition_id=r.id)',
            'rfq' => 'EXISTS (SELECT 1 FROM rfqs f WHERE f.organization_id=r.organization_id AND f.requisition_id=r.id)',
            'supplier_quote' => 'EXISTS (SELECT 1 FROM supplier_quotes sq WHERE sq.organization_id=r.organization_id AND sq.requisition_id=r.id)',
            'customer_quote' => 'EXISTS (SELECT 1 FROM customer_quote_versions cqv WHERE cqv.organization_id=r.organization_id AND cqv.requisition_id=r.id)',
            'purchase_order' => 'EXISTS (SELECT 1 FROM purchase_order_requisitions pr WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id)',
            'receipt' => 'EXISTS (SELECT 1 FROM purchase_order_requisitions pr JOIN goods_receipts gr ON gr.organization_id=pr.organization_id AND gr.purchase_order_id=pr.purchase_order_id WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id)',
            'delivery' => 'EXISTS (SELECT 1 FROM delivery_items di WHERE di.organization_id=r.organization_id AND di.requisition_id=r.id)',
            'invoice' => 'EXISTS (SELECT 1 FROM invoices inv WHERE inv.organization_id=r.organization_id AND inv.requisition_id=r.id)',
        ];
        if (! array_key_exists($document, $rules)) {
            throw new RuntimeException('MATRIX_FILTER_UNKNOWN');
        }
        return $rules[$document];
    }

    private static function fromSql(): string
    {
        return ' FROM requisitions r' .
            " JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id AND e.entity_kind='requisition'" .
            ' JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id' .
            " JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'";
    }

    private static function normalized(array $row): array
    {
        foreach (['line_count','review_count','rfq_count','supplier_quote_count','customer_quote_count',
                  'purchase_order_count','receipt_count','delivery_count','invoice_count','version_number',
                  'current_revision_number','line_number'] as $column) {
            if (isset($row[$column])) {
                $row[$column] = (int) $row[$column];
            }
        }
        // Monetary/quantity DECIMAL values remain strings; don't introduce float rounding.
        return $row;
    }

    private static function countsSql(): string
    {
        return <<<'SQL'
            (SELECT COUNT(*) FROM requisition_items li WHERE li.organization_id=r.organization_id AND li.requisition_id=r.id) AS line_count,
            (SELECT COUNT(*) FROM requisition_reviews rv WHERE rv.organization_id=r.organization_id AND rv.requisition_id=r.id) AS review_count,
            (SELECT COUNT(*) FROM rfqs f WHERE f.organization_id=r.organization_id AND f.requisition_id=r.id) AS rfq_count,
            (SELECT COUNT(*) FROM supplier_quotes sq WHERE sq.organization_id=r.organization_id AND sq.requisition_id=r.id) AS supplier_quote_count,
            (SELECT COUNT(*) FROM customer_quote_versions cqv WHERE cqv.organization_id=r.organization_id AND cqv.requisition_id=r.id) AS customer_quote_count,
            (SELECT COUNT(*) FROM purchase_order_requisitions pr WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id) AS purchase_order_count,
            (SELECT COUNT(DISTINCT gr.id) FROM purchase_order_requisitions pr JOIN goods_receipts gr ON gr.organization_id=pr.organization_id AND gr.purchase_order_id=pr.purchase_order_id WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id) AS receipt_count,
            (SELECT COUNT(DISTINCT di.delivery_id) FROM delivery_items di WHERE di.organization_id=r.organization_id AND di.requisition_id=r.id) AS delivery_count,
            (SELECT COUNT(*) FROM invoices inv WHERE inv.organization_id=r.organization_id AND inv.requisition_id=r.id) AS invoice_count
            SQL;
    }

    private static function headerSql(): string
    {
        return <<<'SQL'
            e.public_id AS id,ce.public_id AS client_id,c.code AS client_code,c.legal_name AS client_name,
            r.folio,r.client_reference,r.internal_reference,r.request_date,r.need_date,r.priority_code,
            r.route_code,r.project_reference_snapshot AS project,r.contract_reference_snapshot AS contract_reference,
            r.requester_name,r.currency_code,r.budget_amount,r.description,r.delivery_place,r.current_revision_number,
            r.notes,r.request_source_type AS source_type,e.created_at,e.updated_at
            SQL;
    }

    public function clients(int $organizationId): array
    {
        $sql = <<<'SQL'
            SELECT ce.public_id AS id,c.code,c.legal_name AS name,COUNT(r.id) AS requisitions
            FROM clients c
            JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'
            LEFT JOIN requisitions r ON r.organization_id=c.organization_id AND r.client_id=c.id
            WHERE c.organization_id=?
            GROUP BY ce.public_id,c.code,c.legal_name
            ORDER BY c.legal_name,c.id
            SQL;
        return ['items' => array_map(static function (array $row): array {
            $row['requisitions'] = (int) $row['requisitions'];
            return $row;
        }, $this->rows($sql, [$organizationId]))];
    }

    public function listing(int $org, int $page, int $pageSize, string $search, string $client, string $has): array
    {
        $where = 'r.organization_id=?';
        $binds = [$org];
        if ($client !== 'all') {
            $where .= ' AND ce.public_id=?';
            $binds[] = $client;
        }
        if ($search !== '') {
            $searchFields = ['r.folio','r.description','r.client_reference','r.internal_reference',
                'r.requester_name','r.project_reference_snapshot','r.contract_reference_snapshot',
                'c.legal_name','c.code'];
            $where .= ' AND (' . implode(' OR ', array_map(static fn(string $x): string => $x . " LIKE ? ESCAPE '!'", $searchFields)) . ')';
            $match = self::like($search);
            foreach ($searchFields as $_) {
                $binds[] = $match;
            }
        }
        if ($has === 'without_purchase_order') {
            $where .= ' AND NOT ' . self::existsSql('purchase_order');
        } elseif ($has !== 'all') {
            $where .= ' AND ' . self::existsSql($has);
        }
        $from = self::fromSql();
        $counter = $this->one('SELECT COUNT(*) AS n' . $from . ' WHERE ' . $where, $binds);
        $total = (int) ($counter['n'] ?? 0);
        $offset = ($page - 1) * $pageSize;
        $sql = 'SELECT ' . self::headerSql() . ', ' . self::countsSql() . $from . ' WHERE ' . $where .
            ' ORDER BY COALESCE(r.request_date, DATE(e.created_at)) DESC,r.id DESC LIMIT ? OFFSET ?';
        $items = array_map([self::class, 'normalized'], $this->rows($sql, [...$binds, $pageSize, $offset]));

        // Summary is intentionally unfiltered, so dashboard cards always describe the source collection.
        $summarySelect = 'SELECT COUNT(*) AS total,';
        $summaryDocs = ['rfq','supplier_quote','customer_quote','purchase_order','receipt','delivery','invoice'];
        foreach ($summaryDocs as $i => $doc) {
            $summarySelect .= ' COALESCE(SUM(CASE WHEN ' . self::existsSql($doc) . ' THEN 1 ELSE 0 END),0) AS with_' . $doc . ',';
        }
        $summarySelect = rtrim($summarySelect, ',') . self::fromSql() . ' WHERE r.organization_id=?';
        $summary = $this->one($summarySelect, [$org]) ?: [];
        foreach ($summary as $key => $value) {
            $summary[$key] = (int) $value;
        }
        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
            'summary' => $summary,
            'source' => 'mariadb',
            'milestone_note' => 'Los hitos se infieren por existencia de documentos vinculados; no sustituyen aprobaciones o estados formales.',
        ];
    }

    /** Return detailed, scoped requisition and the traceable links stored in MariaDB. */
    public function detail(int $org, string $publicId): ?array
    {
        $header = $this->one('SELECT ' . self::headerSql() . ', ' . self::countsSql() .
            self::fromSql() . ' WHERE r.organization_id=? AND e.public_id=?', [$org, $publicId]);
        if (! $header) {
            return null;
        }
        $header = self::normalized($header);
        // Private numeric ID is used internally only; never returned to the browser.
        $id = $this->one('SELECT r.id FROM requisitions r JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id WHERE r.organization_id=? AND e.public_id=? AND e.entity_kind=?', [$org, $publicId, 'requisition']);
        if (! $id) {
            return null;
        }
        $reqId = (int) $id['id'];
        $lines = $this->rows(<<<'SQL'
            SELECT public_id AS id,line_number,description,quantity,unit_label,category_label_snapshot,
                   line_status,legacy_id,history_based
            FROM requisition_items
            WHERE organization_id=? AND requisition_id=?
            ORDER BY line_number,id LIMIT 250
            SQL, [$org, $reqId]);
        foreach ($lines as &$line) {
            $line['line_number'] = (int) $line['line_number'];
            if ($line['history_based'] !== null) {
                $line['history_based'] = (bool) $line['history_based'];
            }
        }
        unset($line);
        $p = [$org, $reqId];
        $documents = [
            'reviews' => $this->rows(<<<'SQL'
                SELECT e.public_id AS id,rv.folio,rv.technical_result AS status,
                       rv.contract_result,rv.budget_result,rv.strategy
                FROM requisition_reviews rv
                JOIN business_entities e ON e.id=rv.id AND e.organization_id=rv.organization_id
                WHERE rv.organization_id=? AND rv.requisition_id=? ORDER BY rv.id DESC LIMIT 100
                SQL, $p),
            'rfqs' => $this->rows(<<<'SQL'
                SELECT e.public_id AS id,f.folio,f.request_date AS date,f.status_code AS status,
                       f.legacy_status,s.legal_name AS supplier
                FROM rfqs f
                JOIN business_entities e ON e.id=f.id AND e.organization_id=f.organization_id
                JOIN suppliers s ON s.id=f.supplier_id AND s.organization_id=f.organization_id
                WHERE f.organization_id=? AND f.requisition_id=? ORDER BY f.id DESC LIMIT 100
                SQL, $p),
            'supplier_quotes' => $this->rows(<<<'SQL'
                SELECT e.public_id AS id,sq.folio,sq.quote_date AS date,sq.status_code AS status,
                       sq.legacy_status,s.legal_name AS supplier,sq.total_amount AS amount,sq.currency_code AS currency
                FROM supplier_quotes sq
                JOIN business_entities e ON e.id=sq.id AND e.organization_id=sq.organization_id
                JOIN suppliers s ON s.id=sq.supplier_id AND s.organization_id=sq.organization_id
                WHERE sq.organization_id=? AND sq.requisition_id=? ORDER BY sq.id DESC LIMIT 100
                SQL, $p),
            'customer_quotes' => $this->rows(<<<'SQL'
                SELECT e.public_id AS id,cqv.folio,cqv.quote_date AS date,
                       cqv.document_status AS status,cqv.internal_approval_status,cqv.client_decision_status,
                       cqv.legacy_status,cqv.total_amount AS amount,cqv.currency_code AS currency,cqv.version_number
                FROM customer_quote_versions cqv
                JOIN business_entities e ON e.id=cqv.id AND e.organization_id=cqv.organization_id
                WHERE cqv.organization_id=? AND cqv.requisition_id=? ORDER BY cqv.quote_date DESC,cqv.version_number DESC,cqv.id DESC LIMIT 100
                SQL, $p),
            'purchase_orders' => $this->rows(<<<'SQL'
                SELECT e.public_id AS id,po.folio,po.order_date AS date,po.operational_status AS status,
                       po.approval_status,po.legacy_status,po.total_amount AS amount,po.currency_code AS currency,po.version_number
                FROM purchase_order_requisitions pr
                JOIN purchase_orders po ON po.id=pr.purchase_order_id AND po.organization_id=pr.organization_id
                JOIN business_entities e ON e.id=po.id AND e.organization_id=po.organization_id
                WHERE pr.organization_id=? AND pr.requisition_id=? ORDER BY po.order_date DESC,po.id DESC LIMIT 100
                SQL, $p),
            'receipts' => $this->rows(<<<'SQL'
                SELECT e.public_id AS id,gr.folio,gr.receipt_date AS date,gr.status_code AS status,
                       gr.capture_grain,gr.legacy_received_percent
                FROM purchase_order_requisitions pr
                JOIN goods_receipts gr ON gr.purchase_order_id=pr.purchase_order_id AND gr.organization_id=pr.organization_id
                JOIN business_entities e ON e.id=gr.id AND e.organization_id=gr.organization_id
                WHERE pr.organization_id=? AND pr.requisition_id=? ORDER BY gr.receipt_date DESC,gr.id DESC LIMIT 100
                SQL, $p),
            'deliveries' => $this->rows(<<<'SQL'
                SELECT e.public_id AS id,d.folio,d.delivery_date AS date,d.status_code AS status,
                       d.acceptance_status,d.legacy_status,COUNT(di.id) AS `lines`
                FROM delivery_items di
                JOIN deliveries d ON d.id=di.delivery_id AND d.organization_id=di.organization_id
                JOIN business_entities e ON e.id=d.id AND e.organization_id=d.organization_id
                WHERE di.organization_id=? AND di.requisition_id=?
                GROUP BY e.public_id,d.folio,d.delivery_date,d.status_code,d.acceptance_status,d.legacy_status,d.id
                ORDER BY d.delivery_date DESC,d.id DESC LIMIT 100
                SQL, $p),
            'invoices' => $this->rows(<<<'SQL'
                SELECT e.public_id AS id,inv.folio,inv.issue_date AS date,inv.status_code AS status,
                       inv.legacy_status,inv.total_amount AS amount,inv.currency_code AS currency
                FROM invoices inv
                JOIN business_entities e ON e.id=inv.id AND e.organization_id=inv.organization_id
                WHERE inv.organization_id=? AND inv.requisition_id=? ORDER BY inv.issue_date DESC,inv.id DESC LIMIT 100
                SQL, $p),
        ];
        foreach ($documents as &$group) {
            foreach ($group as &$doc) {
                $doc = self::normalized($doc);
                if (isset($doc['lines'])) {
                    $doc['lines'] = (int) $doc['lines'];
                }
            }
            unset($doc);
        }
        unset($group);
        return [
            'item' => $header,
            'lines' => $lines,
            'documents' => $documents,
            'limit_per_document_type' => 100,
            'source' => 'mariadb',
            'notes' => [
                'Los estados se muestran según cada documento; la etapa de la Matriz es solo un hito observado.',
                'Los registros de importación con referencias pendientes permanecen en conciliación y no se presentan como relaciones confirmadas.',
                'Las recepciones están vinculadas a la OC y pueden ser únicamente de cabecera; no prueban cantidades recibidas por partida de esta requisición.',
                'Los archivos privados y firmas aún no están disponibles para descarga desde esta pantalla.',
            ],
        ];
    }
}
