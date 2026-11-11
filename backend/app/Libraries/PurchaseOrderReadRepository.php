<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * Read-only purchase orders ("Órdenes de Compra") through the SELECT-only API account.
 * Issuing, authorizing, amending or deleting POs is NOT available here (commercial writes stay blocked).
 * "Current" = latest version of each PO series; receipts and invoices are counted over the whole series (they may be
 * linked to an earlier version). Cancelled/superseded follow the eight-stage policy rule.
 */
final class PurchaseOrderReadRepository
{
    private const CANCELLED = "LOWER(COALESCE(po.legacy_status,po.operational_status,'')) IN ('cancelada','sustituida','cancelled','superseded')";
    private const LATEST = 'NOT EXISTS (SELECT 1 FROM purchase_orders nx WHERE nx.organization_id=po.organization_id AND nx.series_public_id=po.series_public_id AND nx.version_number>po.version_number)';

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
            throw new RuntimeException('PO_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    private static function like(string $v): string
    {
        return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $v) . '%';
    }

    private static function person(string $col): string
    {
        return "(SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id={$col} AND u.organization_id=po.organization_id)";
    }

    private static function header(): string
    {
        $buyer = self::person('po.buyer_user_id');
        $prep = self::person('po.preparer_user_id');
        $auth = self::person('po.authorizer_user_id');
        $resp = self::person('po.current_responsible_user_id');
        return <<<SQL
            e.public_id AS id,po.folio,po.series_public_id AS series_id,po.version_number,po.legacy_revision_number,po.order_date,po.commitment_date,
            po.currency_code AS currency,po.subtotal_amount,po.tax_amount,po.total_amount,po.operational_status,po.approval_status,po.legacy_status,
            po.legacy_workflow_status,po.change_pending,po.change_pending_status,po.modification_approval_status,po.auto_generated,po.reconciliation_status,
            po.order_reference,po.internal_reference,po.authorized_at,po.current_responsible_role,
            se.public_id AS supplier_id,s.code AS supplier_code,s.legal_name AS supplier_name,
            bu.public_id AS buyer_id,{$buyer} AS buyer_name,{$prep} AS preparer_name,{$auth} AS authorizer_name,{$resp} AS responsible_name,
            (SELECT GROUP_CONCAT(DISTINCT r.folio ORDER BY r.folio SEPARATOR ', ') FROM purchase_order_requisitions pr JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id WHERE pr.organization_id=po.organization_id AND pr.purchase_order_id=po.id) AS requisitions,
            (SELECT GROUP_CONCAT(DISTINCT c.legal_name ORDER BY c.legal_name SEPARATOR ', ') FROM purchase_order_requisitions pr JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id WHERE pr.organization_id=po.organization_id AND pr.purchase_order_id=po.id) AS clients,
            (SELECT COUNT(*) FROM goods_receipts gr WHERE gr.organization_id=po.organization_id AND gr.purchase_order_id IN (SELECT s2.id FROM purchase_orders s2 WHERE s2.organization_id=po.organization_id AND s2.series_public_id=po.series_public_id)) AS receipt_count,
            (SELECT MAX(gr.legacy_received_percent) FROM goods_receipts gr WHERE gr.organization_id=po.organization_id AND gr.purchase_order_id IN (SELECT s2.id FROM purchase_orders s2 WHERE s2.organization_id=po.organization_id AND s2.series_public_id=po.series_public_id)) AS received_percent,
            (SELECT COUNT(*) FROM invoices inv WHERE inv.organization_id=po.organization_id AND inv.primary_purchase_order_id IN (SELECT s2.id FROM purchase_orders s2 WHERE s2.organization_id=po.organization_id AND s2.series_public_id=po.series_public_id)) AS invoice_count,
            (SELECT COUNT(*) FROM purchase_orders v WHERE v.organization_id=po.organization_id AND v.series_public_id=po.series_public_id) AS versions,
            (SELECT COUNT(*) FROM purchase_order_items it WHERE it.organization_id=po.organization_id AND it.purchase_order_id=po.id) AS item_count
            SQL;
    }

    private static function from(): string
    {
        return ' FROM purchase_orders po'
            . ' JOIN business_entities e ON e.id=po.id AND e.organization_id=po.organization_id'
            . ' JOIN suppliers s ON s.id=po.supplier_id AND s.organization_id=po.organization_id'
            . ' JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id'
            . ' LEFT JOIN users bu ON bu.id=po.buyer_user_id AND bu.organization_id=po.organization_id';
    }

    private static function normalize(array $r): array
    {
        foreach (['version_number', 'receipt_count', 'invoice_count', 'versions', 'item_count'] as $k) {
            if (array_key_exists($k, $r)) { $r[$k] = (int) $r[$k]; }
        }
        foreach (['change_pending', 'auto_generated'] as $k) {
            if (array_key_exists($k, $r)) { $r[$k] = (bool) $r[$k]; }
        }
        return $r;
    }

    /** @param array{page:int,page_size:int,q:string,status:string,buyer:string,sort:string,scope:string} $f */
    public function list(int $org, array $f): array
    {
        $where = ['po.organization_id=?'];
        $binds = [$org];
        if ($f['scope'] === 'current') { $where[] = self::LATEST; }
        if ($f['status'] !== 'all') { $where[] = 'po.operational_status=?'; $binds[] = $f['status']; }
        if ($f['buyer'] === 'none') { $where[] = 'po.buyer_user_id IS NULL'; }
        elseif ($f['buyer'] !== 'all') { $where[] = 'bu.public_id=?'; $binds[] = $f['buyer']; }
        if ($f['q'] !== '') {
            $fields = ['po.folio', 'po.order_reference', 'po.internal_reference', 's.legal_name', 's.code', 'po.legacy_status'];
            $parts = array_map(static fn (string $x): string => $x . " LIKE ? ESCAPE '!'", $fields);
            $parts[] = "EXISTS (SELECT 1 FROM purchase_order_requisitions pr JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id WHERE pr.organization_id=po.organization_id AND pr.purchase_order_id=po.id AND r.folio LIKE ? ESCAPE '!')";
            $parts[] = "EXISTS (SELECT 1 FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.organization_id=po.organization_id AND u.id IN (po.buyer_user_id,po.preparer_user_id,po.authorizer_user_id) AND p.display_name LIKE ? ESCAPE '!')";
            $where[] = '(' . implode(' OR ', $parts) . ')';
            foreach ($parts as $_) { $binds[] = self::like($f['q']); }
        }
        $order = ['recent' => 'COALESCE(po.order_date,DATE(e.created_at)) DESC,po.id DESC', 'oldest' => 'COALESCE(po.order_date,DATE(e.created_at)) ASC,po.id ASC', 'amount' => 'po.total_amount DESC,po.id DESC'][$f['sort']];
        $whereSql = ' WHERE ' . implode(' AND ', $where);
        $total = (int) ($this->rows('SELECT COUNT(*) AS n' . self::from() . $whereSql, $binds)[0]['n'] ?? 0);
        $items = array_map([self::class, 'normalize'], $this->rows('SELECT ' . self::header() . self::from() . $whereSql . " ORDER BY {$order} LIMIT ? OFFSET ?", [...$binds, $f['page_size'], ($f['page'] - 1) * $f['page_size']]));
        return ['items' => $items, 'total' => $total, 'page' => $f['page'], 'page_size' => $f['page_size'], 'summary' => $this->summary($org)];
    }

    /** Summary over current versions (unfiltered): statuses, buyers, money per currency and control counters. */
    public function summary(int $org): array
    {
        $cur = ' FROM purchase_orders po WHERE po.organization_id=? AND ' . self::LATEST;
        $statuses = array_map(static fn ($r) => ['code' => (string) $r['code'], 'count' => (int) $r['count']], $this->rows('SELECT po.operational_status AS code,COUNT(*) AS count' . $cur . ' GROUP BY po.operational_status ORDER BY count DESC', [$org]));
        $received = 'EXISTS (SELECT 1 FROM goods_receipts gr WHERE gr.organization_id=po.organization_id AND gr.purchase_order_id IN (SELECT s2.id FROM purchase_orders s2 WHERE s2.organization_id=po.organization_id AND s2.series_public_id=po.series_public_id))';
        $buyers = array_map(static fn ($r) => ['id' => $r['id'], 'name' => $r['name'], 'email' => $r['email'], 'count' => (int) $r['count'], 'received' => (int) $r['received']], $this->rows(
            'SELECT u.public_id AS id,p.display_name AS name,u.login_email AS email,COUNT(*) AS count,COALESCE(SUM(' . $received . '),0) AS received FROM purchase_orders po JOIN users u ON u.id=po.buyer_user_id AND u.organization_id=po.organization_id JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE po.organization_id=? AND ' . self::LATEST . ' GROUP BY u.public_id,p.display_name,u.login_email ORDER BY count DESC,p.display_name', [$org]));
        $money = array_map(static fn ($r) => ['currency' => $r['currency'], 'amount' => $r['amount'], 'orders' => (int) $r['orders']], $this->rows(
            'SELECT po.currency_code AS currency,SUM(po.total_amount) AS amount,COUNT(*) AS orders' . $cur . ' AND NOT ' . self::CANCELLED . ' GROUP BY po.currency_code ORDER BY po.currency_code', [$org]));
        $c = $this->rows('SELECT COUNT(*) AS total,COALESCE(SUM(' . $received . '),0) AS received,'
            . 'COALESCE(SUM(po.buyer_user_id IS NULL),0) AS without_buyer,COALESCE(SUM(po.auto_generated),0) AS auto_generated,COALESCE(SUM(po.change_pending),0) AS change_pending,'
            . 'COALESCE(SUM(po.version_number>1),0) AS amended,'
            . 'COALESCE(SUM(po.commitment_date<CURDATE() AND NOT ' . self::CANCELLED . ' AND NOT EXISTS (SELECT 1 FROM goods_receipts gr WHERE gr.organization_id=po.organization_id AND gr.purchase_order_id IN (SELECT s2.id FROM purchase_orders s2 WHERE s2.organization_id=po.organization_id AND s2.series_public_id=po.series_public_id))),0) AS overdue_without_receipt,'
            . "COALESCE(SUM(po.reconciliation_status NOT IN ('reconciled','ok','not_required')),0) AS reconciliation_pending"
            . $cur, [$org])[0] ?? [];
        foreach ($c as $k => $v) { $c[$k] = (int) $v; }
        $awards = $this->rows(<<<'SQL'
            SELECT COUNT(*) AS awarded_items,COUNT(DISTINCT aw.supplier_id) AS winning_suppliers,
              COALESCE(SUM(NOT EXISTS (SELECT 1 FROM purchase_order_requisitions pr JOIN purchase_orders po ON po.id=pr.purchase_order_id AND po.organization_id=pr.organization_id
                 WHERE pr.organization_id=aw.organization_id AND pr.requisition_id=aw.requisition_id AND po.supplier_id=aw.supplier_id)),0) AS awards_without_po
            FROM awards aw WHERE aw.organization_id=? AND aw.status_code='active' AND aw.superseded_at IS NULL
            SQL, [$org])[0] ?? [];
        foreach ($awards as $k => $v) { $awards[$k] = (int) $v; }
        $preselected = (int) ($this->rows("SELECT COUNT(*) AS n FROM supplier_quotes sq WHERE sq.organization_id=? AND (sq.legacy_status REGEXP 'Seleccionada|Preseleccionada|Adjudicada' OR sq.status_code IN ('selected','preselected','awarded'))", [$org])[0]['n'] ?? 0);
        return ['statuses' => $statuses, 'buyers' => $buyers, 'money' => $money, 'counters' => $c + $awards + ['preselected_quotes' => $preselected]];
    }

    /** Requisitions with an active award: winners grouped by supplier and whether a PO already exists (read-only "Emisión"). */
    public function issuance(int $org): array
    {
        $rows = $this->rows(<<<'SQL'
            SELECT re.public_id AS requisition_id,r.folio,c.legal_name AS client_name,se.public_id AS supplier_id,s.legal_name AS supplier_name,
              COUNT(*) AS items,GROUP_CONCAT(DISTINCT aw.currency_code) AS currencies,SUM(aw.subtotal_amount) AS awarded_amount,
              (SELECT GROUP_CONCAT(DISTINCT po.folio ORDER BY po.folio SEPARATOR ', ') FROM purchase_order_requisitions pr JOIN purchase_orders po ON po.id=pr.purchase_order_id AND po.organization_id=pr.organization_id
                 WHERE pr.organization_id=aw.organization_id AND pr.requisition_id=aw.requisition_id AND po.supplier_id=aw.supplier_id) AS existing_pos,
              (SELECT cqv.client_decision_status FROM customer_quote_versions cqv WHERE cqv.organization_id=aw.organization_id AND cqv.requisition_id=aw.requisition_id ORDER BY cqv.quote_date DESC,cqv.version_number DESC,cqv.id DESC LIMIT 1) AS client_decision
            FROM awards aw
            JOIN requisitions r ON r.id=aw.requisition_id AND r.organization_id=aw.organization_id
            JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
            JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            JOIN suppliers s ON s.id=aw.supplier_id AND s.organization_id=aw.organization_id
            JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id
            WHERE aw.organization_id=? AND aw.status_code='active' AND aw.superseded_at IS NULL
            GROUP BY re.public_id,r.folio,c.legal_name,se.public_id,s.legal_name,aw.organization_id,aw.requisition_id,aw.supplier_id
            ORDER BY r.folio,s.legal_name LIMIT 500
            SQL, [$org]);
        $losing = (int) ($this->rows("SELECT COUNT(*) AS n FROM supplier_quotes sq WHERE sq.organization_id=? AND EXISTS (SELECT 1 FROM awards aw WHERE aw.organization_id=sq.organization_id AND aw.requisition_id=sq.requisition_id AND aw.status_code='active') AND NOT EXISTS (SELECT 1 FROM awards aw WHERE aw.organization_id=sq.organization_id AND aw.supplier_quote_id=sq.id AND aw.status_code='active')", [$org])[0]['n'] ?? 0);
        return ['items' => array_map(static function (array $r): array { $r['items'] = (int) $r['items']; return $r; }, $rows), 'losing_quotes' => $losing];
    }

    /** POs needing attention of the current actor (responsible) + modification requests assigned to them. */
    public function tasks(int $org, int $actorId): array
    {
        $mine = array_map([self::class, 'normalize'], $this->rows('SELECT ' . self::header() . self::from() . ' WHERE po.organization_id=? AND ' . self::LATEST . ' AND po.current_responsible_user_id=? ORDER BY po.order_date DESC,po.id DESC LIMIT 200', [$org, $actorId]));
        $requests = $this->rows(<<<'SQL'
            SELECT m.folio,m.change_type,m.urgency,m.reason,m.status_code AS status,m.requested_at,m.decision_code,m.decision_at,
              e.public_id AS purchase_order_id,po.folio AS purchase_order_folio,
              (SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=m.requested_by_user_id AND u.organization_id=m.organization_id) AS requested_by
            FROM purchase_order_modification_requests m
            JOIN purchase_orders po ON po.id=m.purchase_order_id AND po.organization_id=m.organization_id
            JOIN business_entities e ON e.id=po.id AND e.organization_id=po.organization_id
            WHERE m.organization_id=? AND m.assigned_approver_user_id=? ORDER BY m.requested_at DESC LIMIT 200
            SQL, [$org, $actorId]);
        return ['responsible' => $mine, 'modification_requests' => $requests];
    }

    public function detail(int $org, string $publicId): ?array
    {
        $head = $this->rows('SELECT ' . self::header() . ',po.id AS db_id,po.terms_text,po.delivery_schedule_text,po.notes,po.delivery_place,po.incoterm_code,po.payment_method_label,po.payment_form_label,po.cfdi_use_label,po.tax_rate_pct,po.amendment_date,po.amendment_type,po.amendment_reason,po.previous_total_amount,'
            . 's.tax_identifier AS supplier_tax_id,s.credit_type AS supplier_credit_type,s.credit_days AS supplier_credit_days'
            . self::from() . ' WHERE po.organization_id=? AND e.public_id=? LIMIT 1', [$org, $publicId]);
        if (! $head) {
            return null;
        }
        $po = self::normalize($head[0]);
        $id = (int) $po['db_id'];
        unset($po['db_id']);
        $items = $this->rows('SELECT line_number,description,category_snapshot AS category,unit_label,quantity,unit_price,line_subtotal,line_status FROM purchase_order_items WHERE organization_id=? AND purchase_order_id=? ORDER BY line_number,id LIMIT 500', [$org, $id]);
        $versions = $this->rows('SELECT e.public_id AS id,v.folio,v.version_number,v.order_date,v.total_amount,v.currency_code AS currency,v.operational_status,v.legacy_status,v.amendment_type,v.amendment_reason,v.amendment_date FROM purchase_orders v JOIN business_entities e ON e.id=v.id AND e.organization_id=v.organization_id WHERE v.organization_id=? AND v.series_public_id=? ORDER BY v.version_number', [$org, $po['series_id']]);
        $receipts = $this->rows('SELECT gr.folio,gr.receipt_date AS date,gr.status_code AS status,gr.legacy_received_percent AS received_percent FROM goods_receipts gr JOIN purchase_orders s2 ON s2.id=gr.purchase_order_id AND s2.organization_id=gr.organization_id WHERE gr.organization_id=? AND s2.series_public_id=? ORDER BY gr.receipt_date,gr.id', [$org, $po['series_id']]);
        $invoices = $this->rows('SELECT inv.folio,inv.invoice_number,inv.issue_date AS date,inv.status_code AS status,inv.total_amount,inv.currency_code AS currency FROM invoices inv JOIN purchase_orders s2 ON s2.id=inv.primary_purchase_order_id AND s2.organization_id=inv.organization_id WHERE inv.organization_id=? AND s2.series_public_id=? ORDER BY inv.issue_date,inv.id', [$org, $po['series_id']]);
        $requests = $this->rows('SELECT m.folio,m.change_type,m.urgency,m.reason,m.status_code AS status,m.requested_at,m.decision_code,m.decision_at,m.decision_comment FROM purchase_order_modification_requests m WHERE m.organization_id=? AND m.series_public_id=? ORDER BY m.requested_at,m.id', [$org, $po['series_id']]);
        return ['item' => $po, 'items' => $items, 'versions' => $versions, 'receipts' => $receipts, 'invoices' => $invoices, 'modification_requests' => $requests];
    }
}
