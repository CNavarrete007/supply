<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * Factura · read-only queries (API account, schema SELECT). Registering, editing, cancelling or deleting invoices and
 * downloading their private files is NOT exposed; files are described by metadata only.
 *
 * State per invoice (documented in docs/frontend/MAPA_MODULOS_CONECTADOS.md):
 *   cancelled = legacy/status "Cancelada"/"cancelled"; paid = "Pagada"/"paid"; overdue = active, unpaid and due date in the
 *   past; pending = any other active invoice (pending payment). Totals are per currency and exclude cancelled invoices.
 */
final class InvoiceReadRepository
{
    private const STATUS = "LOWER(COALESCE(i.legacy_status,i.status_code,''))";
    private const STATE = "(CASE WHEN LOWER(COALESCE(i.legacy_status,i.status_code,'')) IN ('cancelada','cancelled') THEN 'cancelled'"
        . " WHEN LOWER(COALESCE(i.legacy_status,i.status_code,'')) IN ('pagada','paid') THEN 'paid'"
        . " WHEN i.due_date IS NOT NULL AND i.due_date<CURDATE() THEN 'overdue' ELSE 'pending' END)";

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
            throw new RuntimeException('INVOICE_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    private static function like(string $v): string
    {
        return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $v) . '%';
    }

    private static function header(): string
    {
        $state = self::STATE;
        return <<<SQL
            e.public_id AS id,i.id AS db_id,i.folio,i.invoice_number,i.fiscal_uuid,i.issue_date,i.due_date,i.currency_code AS currency,
            i.subtotal_amount,i.tax_amount,i.total_amount,i.status_code,i.legacy_status,{$state} AS state,i.reconciliation_status,
            i.issuer_snapshot AS issuer,i.receiver_snapshot AS receiver,i.payment_terms,i.notes,i.document_revision_number,i.legacy_receipt_reference,
            re.public_id AS requisition_id,r.folio AS requisition,r.project_reference_snapshot AS project,ce.public_id AS client_id,c.legal_name AS client_name,
            COALESCE((SELECT GROUP_CONCAT(DISTINCT COALESCE(po.folio,ip.po_folio_snapshot) ORDER BY ip.is_primary DESC,ip.source_ordinal SEPARATOR ', ') FROM invoice_purchase_orders ip LEFT JOIN purchase_orders po ON po.id=ip.purchase_order_id AND po.organization_id=ip.organization_id WHERE ip.organization_id=i.organization_id AND ip.invoice_id=i.id),
                     (SELECT po.folio FROM purchase_orders po WHERE po.id=i.primary_purchase_order_id AND po.organization_id=i.organization_id)) AS po_folios,
            f.detected_mime AS file_mime,f.size_bytes AS file_size,f.scan_status AS file_scan,
            (SELECT COUNT(*) FROM invoice_acknowledgments ia WHERE ia.organization_id=i.organization_id AND ia.invoice_id=i.id) AS acknowledgments
            SQL;
    }

    private static function from(): string
    {
        return ' FROM invoices i JOIN business_entities e ON e.id=i.id AND e.organization_id=i.organization_id'
            . ' JOIN requisitions r ON r.id=i.requisition_id AND r.organization_id=i.organization_id'
            . ' JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id'
            . ' JOIN clients c ON c.id=i.client_id AND c.organization_id=i.organization_id'
            . ' JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id'
            . ' LEFT JOIN files f ON f.id=i.document_file_id AND f.organization_id=i.organization_id';
    }

    private static function shape(array &$rows): void
    {
        foreach ($rows as &$r) {
            $r['document_revision_number'] = (int) $r['document_revision_number'];
            $r['acknowledgments'] = (int) $r['acknowledgments'];
            $r['file'] = $r['file_mime'] === null ? null : ['mime' => $r['file_mime'], 'size_bytes' => (int) $r['file_size'], 'scan_status' => $r['file_scan']];
            unset($r['file_mime'], $r['file_size'], $r['file_scan']);
        }
        unset($r);
    }

    public function list(int $org, array $f): array
    {
        $where = ['i.organization_id=?', 'e.archived_at IS NULL'];
        $binds = [$org];
        if ($f['q'] !== '') {
            $l = self::like($f['q']);
            $where[] = "(i.folio LIKE ? ESCAPE '!' OR i.invoice_number LIKE ? ESCAPE '!' OR i.fiscal_uuid LIKE ? ESCAPE '!' OR r.folio LIKE ? ESCAPE '!' OR c.legal_name LIKE ? ESCAPE '!' OR r.project_reference_snapshot LIKE ? ESCAPE '!'"
                . " OR EXISTS (SELECT 1 FROM invoice_purchase_orders ip LEFT JOIN purchase_orders po ON po.id=ip.purchase_order_id AND po.organization_id=ip.organization_id WHERE ip.organization_id=i.organization_id AND ip.invoice_id=i.id AND (po.folio LIKE ? ESCAPE '!' OR ip.po_folio_snapshot LIKE ? ESCAPE '!')))";
            array_push($binds, $l, $l, $l, $l, $l, $l, $l, $l);
        }
        if ($f['client'] !== 'all') {
            $where[] = 'ce.public_id=?';
            $binds[] = $f['client'];
        }
        $base = self::from() . ' WHERE ' . implode(' AND ', $where);
        $state = self::STATE;
        $fb = $binds;
        $filtered = $base . match ($f['state']) {
            'all' => '',
            'active' => " AND {$state}<>'cancelled'",
            default => " AND {$state}=?",
        };
        if (! in_array($f['state'], ['all', 'active'], true)) {
            $fb[] = $f['state'];
        }
        $total = (int) $this->rows('SELECT COUNT(*) AS n' . $filtered, $fb)[0]['n'];
        $items = $this->rows('SELECT ' . self::header() . $filtered . ' ORDER BY i.issue_date DESC,i.id DESC LIMIT ? OFFSET ?', [...$fb, $f['page_size'], ($f['page'] - 1) * $f['page_size']]);
        self::shape($items);
        foreach ($items as &$r) {
            unset($r['db_id']);
        }
        unset($r);
        $states = array_map(static fn ($r) => ['code' => $r['inv_state'], 'count' => (int) $r['count']], $this->rows("SELECT {$state} AS inv_state,COUNT(*) AS count" . $base . ' GROUP BY inv_state ORDER BY inv_state', $binds));
        $money = array_map(static fn ($r) => ['currency' => $r['currency'], 'amount' => $r['amount'], 'invoices' => (int) $r['invoices']],
            $this->rows("SELECT i.currency_code AS currency,SUM(i.total_amount) AS amount,COUNT(*) AS invoices" . $base . " AND {$state}<>'cancelled' GROUP BY i.currency_code ORDER BY i.currency_code", $binds));
        return ['items' => $items, 'total' => $total, 'page' => $f['page'], 'page_size' => $f['page_size'], 'summary' => ['states' => $states, 'money' => $money]];
    }

    public function show(int $org, string $id): ?array
    {
        $rows = $this->rows('SELECT ' . self::header() . self::from() . ' WHERE i.organization_id=? AND e.public_id=? AND e.archived_at IS NULL', [$org, $id]);
        if (! $rows) {
            return null;
        }
        self::shape($rows);
        $inv = $rows[0];
        $dbId = (int) $inv['db_id'];
        unset($inv['db_id']);
        $pos = $this->rows(<<<'SQL'
            SELECT COALESCE(po.folio,ip.po_folio_snapshot) AS folio,po.version_number,ip.is_primary,s.legal_name AS supplier_name,po.total_amount,po.currency_code AS currency
            FROM invoice_purchase_orders ip LEFT JOIN purchase_orders po ON po.id=ip.purchase_order_id AND po.organization_id=ip.organization_id
            LEFT JOIN suppliers s ON s.id=po.supplier_id AND s.organization_id=po.organization_id
            WHERE ip.organization_id=? AND ip.invoice_id=? ORDER BY ip.is_primary DESC,ip.source_ordinal
            SQL, [$org, $dbId]);
        if (! $pos) {
            $pos = $this->rows('SELECT po.folio,po.version_number,1 AS is_primary,s.legal_name AS supplier_name,po.total_amount,po.currency_code AS currency FROM invoices i JOIN purchase_orders po ON po.id=i.primary_purchase_order_id AND po.organization_id=i.organization_id JOIN suppliers s ON s.id=po.supplier_id AND s.organization_id=po.organization_id WHERE i.organization_id=? AND i.id=?', [$org, $dbId]);
        }
        foreach ($pos as &$p) {
            $p['version_number'] = $p['version_number'] === null ? null : (int) $p['version_number'];
            $p['is_primary'] = (bool) $p['is_primary'];
        }
        unset($p);
        $acks = $this->rows(<<<'SQL'
            SELECT ia.signer_name_snapshot AS signer,ia.signer_role_snapshot AS signer_role,ia.acknowledged_on,ia.acknowledged_at,ia.provenance,ia.invoice_document_revision_number AS revision,
                   sg.method_label AS method,sg.integrity_verification_status AS integrity,LOWER(HEX(sg.document_sha256)) AS document_sha256
            FROM invoice_acknowledgments ia LEFT JOIN signature_evidence sg ON sg.id=ia.signature_evidence_id AND sg.organization_id=ia.organization_id
            WHERE ia.organization_id=? AND ia.invoice_id=? ORDER BY ia.recorded_at,ia.id
            SQL, [$org, $dbId]);
        foreach ($acks as &$a) {
            $a['revision'] = (int) $a['revision'];
        }
        unset($a);
        return ['item' => $inv, 'purchase_orders' => $pos, 'acknowledgments' => $acks];
    }

    /** Requisitions with current POs and their stage-6 readiness (card 1 selector). */
    public function requisitions(int $org): array
    {
        $items = (new ReceptionReadRepository($this->db))->readiness($org);
        usort($items, static fn ($a, $b) => [! $a['ready'] || $a['invoiced'], $a['folio']] <=> [! $b['ready'] || $b['invoiced'], $b['folio']]);
        return ['items' => $items];
    }

    /** Requisition context (card 1): readiness, purchase orders, deliveries and its invoices. */
    public function context(int $org, string $id): ?array
    {
        $ready = array_values(array_filter((new ReceptionReadRepository($this->db))->readiness($org), static fn ($r) => $r['id'] === $id))[0] ?? null;
        $req = $this->rows('SELECT r.id,r.folio,r.project_reference_snapshot AS project,c.legal_name AS client_name,c.tax_identifier AS client_tax_id FROM requisitions r JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id WHERE r.organization_id=? AND e.public_id=? AND e.archived_at IS NULL', [$org, $id])[0] ?? null;
        if (! $req) {
            return null;
        }
        $deliveries = $this->rows(<<<'SQL'
            SELECT DISTINCT d.folio,d.delivery_date AS date,d.acceptance_status,d.delivery_type FROM delivery_items di JOIN deliveries d ON d.id=di.delivery_id AND d.organization_id=di.organization_id
            WHERE di.organization_id=? AND di.requisition_id=? ORDER BY d.delivery_date
            SQL, [$org, $req['id']]);
        $invoices = $this->rows('SELECT ' . self::header() . self::from() . ' WHERE i.organization_id=? AND i.requisition_id=? AND e.archived_at IS NULL ORDER BY i.issue_date,i.id', [$org, $req['id']]);
        self::shape($invoices);
        foreach ($invoices as &$r) {
            unset($r['db_id']);
        }
        unset($r);
        unset($req['id']);
        return ['requisition' => $req + ['id' => $id], 'readiness' => $ready, 'deliveries' => $deliveries, 'invoices' => $invoices];
    }

    /** Billing control (card 3): ready to invoice, active, pending payment, overdue, paid and invoiced totals. */
    public function control(int $org): array
    {
        $state = self::STATE;
        $counts = ['pending' => 0, 'overdue' => 0, 'paid' => 0, 'cancelled' => 0];
        foreach ($this->rows("SELECT {$state} AS inv_state,COUNT(*) AS n" . self::from() . ' WHERE i.organization_id=? AND e.archived_at IS NULL GROUP BY inv_state', [$org]) as $r) {
            $counts[$r['inv_state']] = (int) $r['n'];
        }
        $money = $this->rows("SELECT i.currency_code AS currency,SUM(i.total_amount) AS invoiced,SUM(CASE WHEN {$state} IN ('pending','overdue') THEN i.total_amount ELSE 0 END) AS outstanding,SUM(CASE WHEN {$state}='overdue' THEN i.total_amount ELSE 0 END) AS overdue"
            . self::from() . " WHERE i.organization_id=? AND e.archived_at IS NULL AND {$state}<>'cancelled' GROUP BY i.currency_code ORDER BY i.currency_code", [$org]);
        $ready = array_values(array_filter((new ReceptionReadRepository($this->db))->readiness($org), static fn ($r) => $r['ready'] && ! $r['invoiced']));
        $overdue = $this->rows('SELECT ' . self::header() . self::from() . " WHERE i.organization_id=? AND e.archived_at IS NULL AND {$state}='overdue' ORDER BY i.due_date,i.id", [$org]);
        self::shape($overdue);
        foreach ($overdue as &$r) {
            unset($r['db_id']);
        }
        unset($r);
        return [
            'counters' => ['ready_to_invoice' => count($ready), 'active' => $counts['pending'] + $counts['overdue'] + $counts['paid'], 'pending_payment' => $counts['pending'] + $counts['overdue'], 'overdue' => $counts['overdue'], 'paid' => $counts['paid'], 'cancelled' => $counts['cancelled']],
            'money' => $money, 'ready_to_invoice' => array_map(static fn ($r) => ['id' => $r['id'], 'folio' => $r['folio'], 'client_name' => $r['client_name'], 'purchase_orders' => $r['purchase_orders']], $ready), 'overdue' => $overdue,
        ];
    }
}
