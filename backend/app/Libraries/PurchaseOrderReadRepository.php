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
    /**
     * Supplier quote preselected / selected / awarded: legacy status or code, or an active definitive award. "No seleccionada" /
     * "No adjudicada" do NOT count (the plain text match used to include them).
     */
    private const PRESELECTED = "(sq.status_code IN ('selected','preselected','awarded') OR (sq.legacy_status REGEXP 'seleccionad|adjudicad'"
        . " AND sq.legacy_status NOT REGEXP '(^|[^[:alpha:]])no[[:space:]]+(pre)?(seleccionad|adjudicad)')"
        . " OR EXISTS (SELECT 1 FROM awards aw WHERE aw.organization_id=sq.organization_id AND aw.supplier_quote_id=sq.id AND aw.status_code='active' AND aw.superseded_at IS NULL))";
    private const CANCELLED = "LOWER(COALESCE(po.legacy_status,po.operational_status,'')) IN ('cancelada','sustituida','cancelled','superseded')";
    /**
     * Displayed status of a PO (design list): the original Apps Script status when present (Cancelada, Recibida, Enviada…),
     * otherwise the operational code. Used by the matrix pill and the `state` filter.
     */
    private const STATE = "(CASE WHEN NULLIF(TRIM(po.legacy_status),'') IS NOT NULL THEN (CASE"
        . " WHEN LOWER(po.legacy_status) LIKE '%cancel%' THEN 'cancelled' WHEN LOWER(po.legacy_status) LIKE '%sustitu%' OR LOWER(po.legacy_status) LIKE '%reemplaz%' THEN 'superseded'"
        . " WHEN LOWER(po.legacy_status) LIKE '%parcial%' THEN 'partially_received' WHEN LOWER(po.legacy_status) LIKE '%recibid%' OR LOWER(po.legacy_status) LIKE '%cerrad%' THEN 'received'"
        . " WHEN LOWER(po.legacy_status) LIKE '%acept%' THEN 'accepted' WHEN LOWER(po.legacy_status) LIKE '%enviad%' THEN 'sent' WHEN LOWER(po.legacy_status) LIKE '%borrador%' THEN 'draft'"
        . " WHEN LOWER(po.legacy_status) LIKE '%emitid%' THEN 'issued' ELSE 'other' END)"
        . " ELSE (CASE po.operational_status WHEN 'cancelled' THEN 'cancelled' WHEN 'superseded' THEN 'superseded' WHEN 'partially_received' THEN 'partially_received'"
        . " WHEN 'received' THEN 'received' WHEN 'closed' THEN 'received' WHEN 'accepted' THEN 'accepted' WHEN 'sent' THEN 'sent' WHEN 'draft' THEN 'draft' WHEN 'issued' THEN 'issued' ELSE 'other' END) END)";
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
        $state = self::STATE;
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
            (SELECT v.total_amount FROM purchase_orders v WHERE v.organization_id=po.organization_id AND v.series_public_id=po.series_public_id ORDER BY v.version_number LIMIT 1) AS original_total_amount,
            (SELECT v.currency_code FROM purchase_orders v WHERE v.organization_id=po.organization_id AND v.series_public_id=po.series_public_id ORDER BY v.version_number LIMIT 1) AS original_currency,
            (SELECT COUNT(*) FROM invoices inv WHERE inv.organization_id=po.organization_id AND LOWER(COALESCE(inv.legacy_status,inv.status_code,'')) NOT IN ('cancelada','cancelled')
               AND inv.primary_purchase_order_id IN (SELECT s2.id FROM purchase_orders s2 WHERE s2.organization_id=po.organization_id AND s2.series_public_id=po.series_public_id)) AS active_invoice_count,
            (SELECT cr.folio FROM requisition_change_requests cr WHERE cr.id=po.change_request_id AND cr.organization_id=po.organization_id) AS change_request_folio,
            (SELECT COUNT(*) FROM purchase_order_items it WHERE it.organization_id=po.organization_id AND it.purchase_order_id=po.id) AS item_count,
            (SELECT SUBSTRING(GROUP_CONCAT(it.description ORDER BY it.line_number,it.id SEPARATOR ' · '),1,240) FROM purchase_order_items it WHERE it.organization_id=po.organization_id AND it.purchase_order_id=po.id) AS item_summary,
            (SELECT GROUP_CONCAT(m.folio ORDER BY m.requested_at SEPARATOR ', ') FROM purchase_order_modification_requests m WHERE m.organization_id=po.organization_id AND m.series_public_id=po.series_public_id AND m.status_code='pending') AS mod_pending,
            (SELECT GROUP_CONCAT(m.folio ORDER BY m.requested_at SEPARATOR ', ') FROM purchase_order_modification_requests m WHERE m.organization_id=po.organization_id AND m.series_public_id=po.series_public_id AND m.status_code='approved') AS mod_approved,
            {$state} AS state_key
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
        foreach (['version_number', 'receipt_count', 'invoice_count', 'versions', 'item_count', 'active_invoice_count'] as $k) {
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
        if (($f['state'] ?? 'all') !== 'all') { $where[] = self::STATE . '=?'; $binds[] = $f['state']; }
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
        $states = array_map(static fn ($r) => ['code' => (string) $r['code'], 'count' => (int) $r['count']], $this->rows('SELECT ' . self::STATE . ' AS code,COUNT(*) AS count' . $cur . ' GROUP BY code ORDER BY count DESC', [$org]));
        $bmoney = [];
        foreach ($this->rows('SELECT u.public_id AS id,po.currency_code AS currency,SUM(po.total_amount) AS amount FROM purchase_orders po JOIN users u ON u.id=po.buyer_user_id AND u.organization_id=po.organization_id WHERE po.organization_id=? AND ' . self::LATEST . ' AND NOT ' . self::CANCELLED . ' GROUP BY u.public_id,po.currency_code ORDER BY po.currency_code', [$org]) as $m) {
            $bmoney[$m['id']][] = ['currency' => $m['currency'], 'amount' => $m['amount']];
        }
        $bextra = [];
        foreach ($this->rows('SELECT u.public_id AS id,p.phone,p.position_title AS position,COUNT(DISTINCT po.supplier_id) AS suppliers,'
            . '(SELECT COUNT(DISTINCT pr.requisition_id) FROM purchase_order_requisitions pr JOIN purchase_orders p2 ON p2.id=pr.purchase_order_id AND p2.organization_id=pr.organization_id WHERE pr.organization_id=u.organization_id AND p2.buyer_user_id=u.id AND NOT EXISTS (SELECT 1 FROM purchase_orders nx WHERE nx.organization_id=p2.organization_id AND nx.series_public_id=p2.series_public_id AND nx.version_number>p2.version_number)) AS requisitions'
            . ' FROM purchase_orders po JOIN users u ON u.id=po.buyer_user_id AND u.organization_id=po.organization_id JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id'
            . ' WHERE po.organization_id=? AND ' . self::LATEST . ' GROUP BY u.public_id,u.id,u.organization_id,p.phone,p.position_title', [$org]) as $x) {
            $bextra[$x['id']] = ['phone' => $x['phone'], 'position' => $x['position'], 'suppliers' => (int) $x['suppliers'], 'requisitions' => (int) $x['requisitions']];
        }
        $buyers = array_map(static fn ($r) => ['id' => $r['id'], 'name' => $r['name'], 'email' => $r['email'], 'count' => (int) $r['count'], 'received' => (int) $r['received']]
            + ($bextra[$r['id']] ?? ['phone' => null, 'position' => null, 'suppliers' => 0, 'requisitions' => 0]) + ['money' => $bmoney[$r['id']] ?? []], $this->rows(
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
                 WHERE pr.organization_id=aw.organization_id AND pr.requisition_id=aw.requisition_id AND po.supplier_id=aw.supplier_id
                   AND LOWER(COALESCE(po.legacy_status,po.operational_status,'')) NOT IN ('cancelada','sustituida','cancelled','superseded'))),0) AS awards_without_po
            FROM awards aw WHERE aw.organization_id=? AND aw.status_code='active' AND aw.superseded_at IS NULL
            SQL, [$org])[0] ?? [];
        foreach ($awards as $k => $v) { $awards[$k] = (int) $v; }
        $preselected = (int) ($this->rows('SELECT COUNT(*) AS n FROM supplier_quotes sq WHERE sq.organization_id=? AND ' . self::PRESELECTED, [$org])[0]['n'] ?? 0);
        return ['statuses' => $statuses, 'states' => $states, 'buyers' => $buyers, 'money' => $money, 'counters' => $c + $awards + ['preselected_quotes' => $preselected]];
    }

    /** Requisitions with an active award: winners grouped by supplier and whether a PO already exists (read-only "Emisión"). */
    public function issuance(int $org): array
    {
        $rows = $this->rows(<<<'SQL'
            SELECT re.public_id AS requisition_id,r.folio,c.legal_name AS client_name,se.public_id AS supplier_id,s.legal_name AS supplier_name,
              COUNT(*) AS items,GROUP_CONCAT(DISTINCT aw.currency_code) AS currencies,SUM(aw.subtotal_amount) AS awarded_amount,
              (SELECT GROUP_CONCAT(DISTINCT po.folio ORDER BY po.folio SEPARATOR ', ') FROM purchase_order_requisitions pr JOIN purchase_orders po ON po.id=pr.purchase_order_id AND po.organization_id=pr.organization_id
                 WHERE pr.organization_id=aw.organization_id AND pr.requisition_id=aw.requisition_id AND po.supplier_id=aw.supplier_id) AS existing_pos,
              (SELECT GROUP_CONCAT(DISTINCT po.folio ORDER BY po.folio SEPARATOR ', ') FROM purchase_order_requisitions pr JOIN purchase_orders po ON po.id=pr.purchase_order_id AND po.organization_id=pr.organization_id
                 WHERE pr.organization_id=aw.organization_id AND pr.requisition_id=aw.requisition_id AND po.supplier_id=aw.supplier_id
                   AND LOWER(COALESCE(po.legacy_status,po.operational_status,'')) NOT IN ('cancelada','sustituida','cancelled','superseded')) AS active_pos,
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
        return ['items' => array_map(static function (array $r): array { $r['items'] = (int) $r['items']; return $r; }, $rows), 'losing_quotes' => $losing,
            'requisitions' => $this->issuanceRequisitions($org), 'lines' => $this->issuanceLines($org), 'alerts' => $this->issuanceAlerts($org)];
    }

    /**
     * Card 3 "Control de autorización": the documents behind each alert (same rules as summary counters; current version of
     * each PO; at most 200 per list). Read-only.
     */
    private function issuanceAlerts(int $org): array
    {
        $noReceipt = 'NOT EXISTS (SELECT 1 FROM goods_receipts gr WHERE gr.organization_id=po.organization_id AND gr.purchase_order_id IN (SELECT s2.id FROM purchase_orders s2 WHERE s2.organization_id=po.organization_id AND s2.series_public_id=po.series_public_id))';
        $base = 'SELECT e.public_id AS id,po.folio,po.version_number,po.legacy_revision_number,po.order_date,po.commitment_date,po.currency_code AS currency,po.total_amount,s.legal_name AS supplier_name,'
            . self::person('po.buyer_user_id') . ' AS buyer_name,'
            . '(SELECT GROUP_CONCAT(DISTINCT r.folio ORDER BY r.folio SEPARATOR \', \') FROM purchase_order_requisitions pr JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id WHERE pr.organization_id=po.organization_id AND pr.purchase_order_id=po.id) AS requisitions'
            . self::from() . ' WHERE po.organization_id=? AND ' . self::LATEST;
        $overdue = $this->rows($base . ' AND po.commitment_date<CURDATE() AND NOT ' . self::CANCELLED . ' AND ' . $noReceipt . ' ORDER BY po.commitment_date,po.id LIMIT 200', [$org]);
        $auto = $this->rows($base . ' AND po.auto_generated=1 ORDER BY po.order_date DESC,po.id DESC LIMIT 200', [$org]);
        $preselected = <<<'SQL'
            SELECT sq.folio,s.legal_name AS supplier_name,r.folio AS requisition,COALESCE(NULLIF(TRIM(sq.legacy_status),''),sq.status_code) AS status,
              sq.quote_date,sq.currency_code AS currency,sq.total_amount,
              EXISTS (SELECT 1 FROM awards aw WHERE aw.organization_id=sq.organization_id AND aw.supplier_quote_id=sq.id AND aw.status_code='active' AND aw.superseded_at IS NULL) AS awarded
            FROM supplier_quotes sq
            JOIN suppliers s ON s.id=sq.supplier_id AND s.organization_id=sq.organization_id
            JOIN requisitions r ON r.id=sq.requisition_id AND r.organization_id=sq.organization_id
            WHERE sq.organization_id=? AND %s
            ORDER BY sq.quote_date DESC,sq.id DESC LIMIT 200
            SQL;
        $preselected = $this->rows(sprintf($preselected, self::PRESELECTED), [$org]);
        foreach ($preselected as &$q) {
            $q['awarded'] = (bool) $q['awarded'];
        }
        unset($q);
        return ['overdue_without_receipt' => $overdue, 'auto_generated' => $auto, 'preselected_quotes' => $preselected];
    }

    /**
     * Card 1 selector: requisitions with an active definitive award OR a current client quote APPROVED (same status rule as
     * Cotizaciones, QuoteReadRepository::STATUS_KEY over the current version of each client quote). client_approved tells
     * whether a PO may be issued; quotes_received counts every supplier quote (winners and losers).
     */
    private function issuanceRequisitions(int $org): array
    {
        $key = QuoteReadRepository::STATUS_KEY;
        $current = 'NOT EXISTS (SELECT 1 FROM customer_quote_versions nx WHERE nx.organization_id=v.organization_id AND nx.customer_quote_id=v.customer_quote_id AND nx.version_number>v.version_number)';
        $approved = "EXISTS (SELECT 1 FROM customer_quote_versions v WHERE v.organization_id=r.organization_id AND v.requisition_id=r.id AND {$current} AND ({$key})='approved')";
        $award = "EXISTS (SELECT 1 FROM awards aw WHERE aw.organization_id=r.organization_id AND aw.requisition_id=r.id AND aw.status_code='active' AND aw.superseded_at IS NULL)";
        $rows = $this->rows(<<<SQL
            SELECT re.public_id AS id,r.folio,r.client_reference,r.project_reference_snapshot AS project,c.legal_name AS client_name,
              IF({$approved},1,0) AS client_approved,
              (SELECT GROUP_CONCAT(v.folio ORDER BY v.quote_date DESC,v.version_number DESC SEPARATOR ', ') FROM customer_quote_versions v WHERE v.organization_id=r.organization_id AND v.requisition_id=r.id AND {$current} AND ({$key})='approved') AS customer_quote,
              (SELECT COUNT(*) FROM supplier_quotes sq WHERE sq.organization_id=r.organization_id AND sq.requisition_id=r.id) AS quotes_received,
              (SELECT COUNT(*) FROM requisition_items ri WHERE ri.organization_id=r.organization_id AND ri.requisition_id=r.id AND ri.cancelled_at IS NULL) AS item_count,
              (SELECT COUNT(DISTINCT aw.requisition_item_id) FROM awards aw WHERE aw.organization_id=r.organization_id AND aw.requisition_id=r.id AND aw.status_code='active' AND aw.superseded_at IS NULL) AS awarded_items
            FROM requisitions r
            JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
            JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            WHERE r.organization_id=? AND re.archived_at IS NULL AND ({$award} OR {$approved})
            ORDER BY r.folio LIMIT 500
            SQL, [$org]);
        foreach ($rows as &$r) {
            $r['client_approved'] = (bool) $r['client_approved'];
            foreach (['quotes_received', 'item_count', 'awarded_items'] as $k) {
                $r[$k] = (int) $r[$k];
            }
        }
        unset($r);
        return $rows;
    }

    /** Awarded lines (active definitive award) per requisition and winning supplier; losing quotes are never listed. */
    private function issuanceLines(int $org): array
    {
        return $this->rows(<<<'SQL'
            SELECT re.public_id AS requisition_id,se.public_id AS supplier_id,ri.line_number,ri.description,aw.quantity,ri.unit_label,aw.unit_price,
              aw.subtotal_amount AS subtotal,aw.currency_code AS currency,sq.folio AS quote_folio
            FROM awards aw
            JOIN requisitions r ON r.id=aw.requisition_id AND r.organization_id=aw.organization_id
            JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
            JOIN requisition_items ri ON ri.id=aw.requisition_item_id AND ri.organization_id=aw.organization_id
            JOIN suppliers s ON s.id=aw.supplier_id AND s.organization_id=aw.organization_id
            JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id
            JOIN supplier_quotes sq ON sq.id=aw.supplier_quote_id AND sq.organization_id=aw.organization_id
            WHERE aw.organization_id=? AND aw.status_code='active' AND aw.superseded_at IS NULL AND re.archived_at IS NULL
            ORDER BY r.folio,s.legal_name,ri.line_number,aw.id LIMIT 2000
            SQL, [$org]);
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
        return ['responsible' => $mine, 'modification_requests' => $requests] + $this->reviewFlow($org, $actorId);
    }

    /**
     * Card 5 "Flujo de revisión y autorización" (read-only): POs related to the actor (buyer / preparer-reviewer / authorizer)
     * with the client quote approved for them, the workflow history of those POs, unread PO notifications and every
     * modification request of the organization (with who requested, who decides and whether it was executed).
     */
    private function reviewFlow(int $org, int $me): array
    {
        $related = $this->flowRows($org, $me, '(po.buyer_user_id=? OR po.preparer_user_id=? OR po.authorizer_user_id=?)', [$me, $me, $me]);
        $mine = $this->flowRows($org, $me, 'po.current_responsible_user_id=?', [$me]);
        $name = static fn (string $col) => "(SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id={$col} AND u.organization_id=m.organization_id)";
        $history = $this->rows(<<<SQL
            SELECT we.occurred_at,e.public_id AS purchase_order_id,po.folio,po.version_number,po.legacy_revision_number,we.workflow_code,we.action_code,we.from_state,we.to_state,we.legacy_action_text,we.comment_text,
              COALESCE((SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=we.actor_user_id AND u.organization_id=we.organization_id),
                       CASE WHEN JSON_VALID(we.actor_snapshot) THEN JSON_UNQUOTE(JSON_EXTRACT(we.actor_snapshot,'$.name')) END) AS actor_name
            FROM workflow_events we
            JOIN purchase_orders po ON po.id=we.entity_id AND po.organization_id=we.organization_id
            JOIN business_entities e ON e.id=po.id AND e.organization_id=po.organization_id
            WHERE we.organization_id=? AND (we.actor_user_id=? OR we.target_user_id=? OR po.buyer_user_id=? OR po.preparer_user_id=? OR po.authorizer_user_id=? OR po.current_responsible_user_id=?)
            ORDER BY we.occurred_at DESC,we.id DESC LIMIT 200
            SQL, [$org, $me, $me, $me, $me, $me, $me]);
        $unread = (int) ($this->rows('SELECT COUNT(*) AS n FROM notifications n WHERE n.organization_id=? AND n.recipient_user_id=? AND n.is_read=0'
            . ' AND EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id=n.entity_id AND po.organization_id=n.organization_id)', [$org, $me])[0]['n'] ?? 0);
        $all = $this->rows('SELECT m.folio,m.change_type,m.urgency,m.reason,m.reference_text,m.impact_text,m.status_code AS status,m.requested_at,m.decision_code,m.decision_at,m.decision_comment,m.consumed_at,'
            . 'e.public_id AS purchase_order_id,po.folio AS purchase_order_folio,po.version_number,po.legacy_revision_number,s.legal_name AS supplier_name,'
            . $name('m.requested_by_user_id') . ' AS requested_by,' . $name('m.assigned_approver_user_id') . ' AS approver,' . $name('m.decided_by_user_id') . ' AS decided_by,'
            . '(m.assigned_approver_user_id=?) AS assigned_to_me,(m.requested_by_user_id=?) AS requested_by_me,'
            . '(SELECT ge.public_id FROM business_entities ge WHERE ge.id=m.generated_purchase_order_id AND ge.organization_id=m.organization_id) AS generated_purchase_order_id'
            . ' FROM purchase_order_modification_requests m JOIN purchase_orders po ON po.id=m.purchase_order_id AND po.organization_id=m.organization_id'
            . ' JOIN business_entities e ON e.id=po.id AND e.organization_id=po.organization_id JOIN suppliers s ON s.id=po.supplier_id AND s.organization_id=po.organization_id'
            . ' WHERE m.organization_id=? ORDER BY m.requested_at DESC,m.id DESC LIMIT 500', [$me, $me, $org]);
        foreach ($all as &$m) {
            $m['assigned_to_me'] = (bool) $m['assigned_to_me']; $m['requested_by_me'] = (bool) $m['requested_by_me']; $m['version_number'] = (int) $m['version_number'];
        }
        unset($m);
        return ['related' => $related, 'my_tasks' => $mine, 'history' => $history, 'notifications_unread' => $unread, 'all_modification_requests' => $all];
    }

    /** Current-version POs matching $where, with the actor's role flags and the client quote approved for them. */
    private function flowRows(int $org, int $me, string $where, array $binds): array
    {
        $key = QuoteReadRepository::STATUS_KEY;
        $cur = 'NOT EXISTS (SELECT 1 FROM customer_quote_versions nx WHERE nx.organization_id=v.organization_id AND nx.customer_quote_id=v.customer_quote_id AND nx.version_number>v.version_number)';
        $cq = "COALESCE(po.source_customer_quote_version_id,(SELECT v.id FROM purchase_order_requisitions pr JOIN customer_quote_versions v ON v.requisition_id=pr.requisition_id AND v.organization_id=pr.organization_id"
            . " WHERE pr.organization_id=po.organization_id AND pr.purchase_order_id=po.id AND {$cur} AND ({$key})='approved' ORDER BY pr.is_primary DESC,v.quote_date DESC,v.id DESC LIMIT 1))";
        $rows = array_map([self::class, 'normalize'], $this->rows('SELECT ' . self::header() . ',e.updated_at,po.authorized_at AS authorized_on,'
            . '(po.buyer_user_id=?) AS me_buyer,(po.preparer_user_id=?) AS me_preparer,(po.authorizer_user_id=?) AS me_authorizer,(po.current_responsible_user_id=?) AS me_responsible,' . $cq . ' AS cq_db_id'
            . self::from() . ' WHERE po.organization_id=? AND ' . self::LATEST . " AND {$where} ORDER BY e.updated_at DESC,po.id DESC LIMIT 200", [$me, $me, $me, $me, $org, ...$binds]));
        $ids = array_values(array_unique(array_filter(array_map(static fn ($r) => (int) $r['cq_db_id'], $rows))));
        $cqs = [];
        if ($ids !== []) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            foreach ($this->rows("SELECT v.id,ve.public_id,v.folio,COALESCE(v.legacy_revision_number,v.version_number-1) AS revision,v.total_amount,v.currency_code AS currency,({$key}) AS status_key,"
                . "(SELECT MAX(d.decision_at) FROM customer_quote_decisions d WHERE d.organization_id=v.organization_id AND d.customer_quote_version_id=v.id AND d.decision_code='approved') AS approved_at"
                . " FROM customer_quote_versions v JOIN business_entities ve ON ve.id=v.id AND ve.organization_id=v.organization_id WHERE v.organization_id=? AND v.id IN ({$in})", [$org, ...$ids]) as $q) {
                $cqs[(int) $q['id']] = ['id' => $q['public_id'], 'folio' => $q['folio'], 'revision' => (int) $q['revision'], 'total_amount' => $q['total_amount'], 'currency' => $q['currency'],
                    'status_key' => $q['status_key'], 'approved_at' => $q['approved_at']];
            }
        }
        foreach ($rows as &$r) {
            foreach (['me_buyer', 'me_preparer', 'me_authorizer', 'me_responsible'] as $k) {
                $r[$k] = (bool) $r[$k];
            }
            $r['client_quote'] = $cqs[(int) $r['cq_db_id']] ?? null;
            unset($r['cq_db_id']);
        }
        unset($r);
        return $rows;
    }

    /**
     * Extra fields of the formal PO format (Formato de Orden de Compra): contact e-mail and position of the people who
     * bought / prepared / authorized, the supplier's primary contact, and the "bill to" / "send invoice to" snapshots when
     * they were stored as plain text. Read-only.
     */
    private static function formatFields(): string
    {
        $p = static fn (string $col, string $expr) => "(SELECT {$expr} FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id={$col} AND u.organization_id=po.organization_id)";
        $scalar = static fn (string $col) => "(CASE WHEN {$col} IS NOT NULL AND JSON_VALID({$col}) AND JSON_TYPE({$col})='STRING' THEN NULLIF(TRIM(JSON_UNQUOTE({$col})),'') END)";
        $contact = "(SELECT pc.%s FROM party_contacts pc WHERE pc.organization_id=s.organization_id AND pc.owner_entity_id=s.id AND pc.active=1 ORDER BY pc.is_primary DESC,pc.source_ordinal,pc.id LIMIT 1)";
        $channel = "(SELECT cc.value FROM party_contact_channels cc WHERE cc.organization_id=s.organization_id AND cc.owner_entity_id=s.id AND cc.channel_type='%s' ORDER BY cc.is_primary DESC,cc.source_ordinal,cc.id LIMIT 1)";
        return implode(',', [
            $p('po.buyer_user_id', 'COALESCE(NULLIF(TRIM(p.email),\'\'),u.login_email)') . ' AS buyer_email',
            $p('po.buyer_user_id', 'p.position_title') . ' AS buyer_position',
            $p('po.preparer_user_id', 'p.position_title') . ' AS preparer_position',
            $p('po.authorizer_user_id', 'p.position_title') . ' AS authorizer_position',
            sprintf($contact, 'display_name') . ' AS supplier_contact',
            sprintf($channel, 'email') . ' AS supplier_contact_email',
            sprintf($channel, 'phone') . ' AS supplier_contact_phone',
            $scalar('po.bill_to_snapshot') . ' AS bill_to',
            $scalar('po.invoice_contact_snapshot') . ' AS invoice_to',
        ]) . ' ';
    }

    public function detail(int $org, string $publicId): ?array
    {
        $head = $this->rows('SELECT ' . self::header() . ',po.id AS db_id,po.terms_text,po.delivery_schedule_text,po.notes,po.delivery_place,po.incoterm_code,po.payment_method_label,po.payment_form_label,po.cfdi_use_label,po.tax_rate_pct,po.amendment_date,po.amendment_type,po.amendment_reason,po.previous_total_amount,'
            . 's.tax_identifier AS supplier_tax_id,s.credit_type AS supplier_credit_type,s.credit_days AS supplier_credit_days,' . self::formatFields()
            . self::from() . ' WHERE po.organization_id=? AND e.public_id=? LIMIT 1', [$org, $publicId]);
        if (! $head) {
            return null;
        }
        $po = self::normalize($head[0]);
        $id = (int) $po['db_id'];
        unset($po['db_id']);
        $items = $this->rows('SELECT line_number,description,category_snapshot AS category,unit_label,quantity,unit_price,line_subtotal,line_status FROM purchase_order_items WHERE organization_id=? AND purchase_order_id=? ORDER BY line_number,id LIMIT 500', [$org, $id]);
        $versions = $this->rows('SELECT e.public_id AS id,v.folio,v.version_number,v.legacy_revision_number,v.order_date,v.total_amount,v.currency_code AS currency,v.operational_status,v.legacy_status,v.amendment_type,v.amendment_reason,v.amendment_date FROM purchase_orders v JOIN business_entities e ON e.id=v.id AND e.organization_id=v.organization_id WHERE v.organization_id=? AND v.series_public_id=? ORDER BY v.version_number', [$org, $po['series_id']]);
        $receipts = $this->rows('SELECT gr.folio,gr.receipt_date AS date,gr.status_code AS status,gr.legacy_received_percent AS received_percent FROM goods_receipts gr JOIN purchase_orders s2 ON s2.id=gr.purchase_order_id AND s2.organization_id=gr.organization_id WHERE gr.organization_id=? AND s2.series_public_id=? ORDER BY gr.receipt_date,gr.id', [$org, $po['series_id']]);
        $invoices = $this->rows('SELECT inv.folio,inv.invoice_number,inv.issue_date AS date,inv.status_code AS status,inv.total_amount,inv.currency_code AS currency FROM invoices inv JOIN purchase_orders s2 ON s2.id=inv.primary_purchase_order_id AND s2.organization_id=inv.organization_id WHERE inv.organization_id=? AND s2.series_public_id=? ORDER BY inv.issue_date,inv.id', [$org, $po['series_id']]);
        $requests = $this->rows('SELECT m.folio,m.change_type,m.urgency,m.reason,m.status_code AS status,m.requested_at,m.decision_code,m.decision_at,m.decision_comment FROM purchase_order_modification_requests m WHERE m.organization_id=? AND m.series_public_id=? ORDER BY m.requested_at,m.id', [$org, $po['series_id']]);
        return ['item' => $po, 'items' => $items, 'versions' => $versions, 'receipts' => $receipts, 'invoices' => $invoices, 'modification_requests' => $requests];
    }
}
