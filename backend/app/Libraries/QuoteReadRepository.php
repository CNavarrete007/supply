<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * Read-only "Cotizaciones y Comparativo" through the SELECT-only API account: RFQs, supplier quotes, comparison per
 * requisition, client quotes (versions + decisions) and definitive awards. No RFQ, quote, award or decision is written.
 * Internal costs (customer_quote_items.cost_amount, extra, margin) are only returned by the internal endpoints.
 */
final class QuoteReadRepository
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
            throw new RuntimeException('QUOTE_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    private static function like(string $v): string
    {
        return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $v) . '%';
    }

    /** @return array{0:string,1:array} */
    private static function search(string $q, array $fields): array
    {
        if ($q === '') {
            return ['', []];
        }
        return [' AND (' . implode(' OR ', array_map(static fn (string $x): string => $x . " LIKE ? ESCAPE '!'", $fields)) . ')', array_fill(0, count($fields), self::like($q))];
    }

    private function page(string $select, string $from, string $where, array $binds, string $order, array $f): array
    {
        $total = (int) ($this->rows('SELECT COUNT(*) AS n ' . $from . ' WHERE ' . $where, $binds)[0]['n'] ?? 0);
        $items = $this->rows('SELECT ' . $select . ' ' . $from . ' WHERE ' . $where . ' ORDER BY ' . $order . ' LIMIT ? OFFSET ?', [...$binds, $f['page_size'], ($f['page'] - 1) * $f['page_size']]);
        return ['items' => $items, 'total' => $total, 'page' => $f['page'], 'page_size' => $f['page_size']];
    }

    private const REQ = ' JOIN requisitions r ON r.id=%1$s.requisition_id AND r.organization_id=%1$s.organization_id JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id';
    private const SUP = ' JOIN suppliers s ON s.id=%1$s.supplier_id AND s.organization_id=%1$s.organization_id JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id';

    /** @param array{page:int,page_size:int,q:string,status:string,supplier:string} $f */
    public function rfqs(int $org, array $f): array
    {
        $from = 'FROM rfqs f JOIN business_entities e ON e.id=f.id AND e.organization_id=f.organization_id' . sprintf(self::REQ, 'f') . sprintf(self::SUP, 'f');
        $where = 'f.organization_id=?';
        $binds = [$org];
        if ($f['status'] !== 'all') { $where .= ' AND f.status_code=?'; $binds[] = $f['status']; }
        if ($f['supplier'] !== 'all') { $where .= ' AND se.public_id=?'; $binds[] = $f['supplier']; }
        [$sq, $sb] = self::search($f['q'], ['f.folio', 'r.folio', 's.legal_name', 'c.legal_name', 'f.legacy_status']);
        $responded = 'EXISTS (SELECT 1 FROM supplier_quotes q WHERE q.organization_id=f.organization_id AND q.rfq_id=f.id)';
        $res = $this->page("e.public_id AS id,f.folio,f.request_date,f.deadline,f.required_date,f.currency_code AS currency,f.status_code AS status,f.legacy_status,
            r.folio AS requisition,c.legal_name AS client_name,se.public_id AS supplier_id,s.legal_name AS supplier_name,
            (SELECT COUNT(*) FROM rfq_items it WHERE it.organization_id=f.organization_id AND it.rfq_id=f.id) AS item_count,
            {$responded} AS responded,(SELECT q.folio FROM supplier_quotes q WHERE q.organization_id=f.organization_id AND q.rfq_id=f.id ORDER BY q.id LIMIT 1) AS quote_folio,
            (SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=f.internal_contact_user_id AND u.organization_id=f.organization_id) AS contact_name",
            $from, $where . $sq, [...$binds, ...$sb], 'COALESCE(f.request_date,DATE(e.created_at)) DESC,f.id DESC', $f);
        foreach ($res['items'] as &$i) { $i['item_count'] = (int) $i['item_count']; $i['responded'] = (bool) $i['responded']; }
        unset($i);
        $s = $this->rows("SELECT COUNT(*) AS total,COALESCE(SUM({$responded}),0) AS responded,COALESCE(SUM(f.deadline<CURDATE() AND NOT {$responded}),0) AS overdue FROM rfqs f WHERE f.organization_id=?", [$org])[0] ?? [];
        $res['summary'] = array_map('intval', $s) + ['statuses' => $this->facet('SELECT f.status_code AS code,COUNT(*) AS count FROM rfqs f WHERE f.organization_id=? GROUP BY f.status_code ORDER BY count DESC', $org)];
        return $res;
    }

    public function rfq(int $org, string $id): ?array
    {
        $h = $this->rows('SELECT e.public_id AS id,f.id AS db_id,f.folio,f.request_date,f.deadline,f.required_date,f.currency_code AS currency,f.status_code AS status,f.legacy_status,f.delivery_place,f.requested_documents_text,f.terms_text,
            r.folio AS requisition,c.legal_name AS client_name,s.legal_name AS supplier_name,s.code AS supplier_code,s.tax_identifier AS supplier_tax_id
            FROM rfqs f JOIN business_entities e ON e.id=f.id AND e.organization_id=f.organization_id' . sprintf(self::REQ, 'f') . sprintf(self::SUP, 'f') . ' WHERE f.organization_id=? AND e.public_id=? LIMIT 1', [$org, $id]);
        if (! $h) {
            return null;
        }
        $rfq = $h[0];
        $items = $this->rows('SELECT line_number,description,specification,category_snapshot AS category,unit_label,quantity FROM rfq_items WHERE organization_id=? AND rfq_id=? ORDER BY line_number,id', [$org, (int) $rfq['db_id']]);
        unset($rfq['db_id']);
        return ['item' => $rfq, 'items' => $items];
    }

    private function facet(string $sql, int $org): array
    {
        return array_map(static fn ($r) => ['code' => (string) $r['code'], 'count' => (int) $r['count']], $this->rows($sql, [$org]));
    }

    /** @param array{page:int,page_size:int,q:string,status:string,supplier:string} $f */
    public function supplierQuotes(int $org, array $f): array
    {
        $from = 'FROM supplier_quotes q JOIN business_entities e ON e.id=q.id AND e.organization_id=q.organization_id' . sprintf(self::REQ, 'q') . sprintf(self::SUP, 'q');
        $where = 'q.organization_id=?';
        $binds = [$org];
        if ($f['status'] !== 'all') { $where .= ' AND q.status_code=?'; $binds[] = $f['status']; }
        if ($f['supplier'] !== 'all') { $where .= ' AND se.public_id=?'; $binds[] = $f['supplier']; }
        [$sq, $sb] = self::search($f['q'], ['q.folio', 'q.supplier_reference', 'r.folio', 's.legal_name', 'c.legal_name', 'q.legacy_status']);
        $awarded = "EXISTS (SELECT 1 FROM awards aw WHERE aw.organization_id=q.organization_id AND aw.supplier_quote_id=q.id AND aw.status_code='active' AND aw.superseded_at IS NULL)";
        $res = $this->page("e.public_id AS id,q.folio,q.supplier_reference,q.quote_date,q.valid_until,q.currency_code AS currency,q.subtotal_amount,q.tax_amount,q.total_amount,
            q.lead_days,q.payment_terms,q.technical_score,q.document_score,q.status_code AS status,q.legacy_status,q.source_kind,
            r.folio AS requisition,c.legal_name AS client_name,se.public_id AS supplier_id,s.code AS supplier_code,s.legal_name AS supplier_name,
            (SELECT f.folio FROM rfqs f WHERE f.id=q.rfq_id AND f.organization_id=q.organization_id) AS rfq_folio,
            (SELECT COUNT(*) FROM supplier_quote_items it WHERE it.organization_id=q.organization_id AND it.supplier_quote_id=q.id) AS item_count,{$awarded} AS awarded",
            $from, $where . $sq, [...$binds, ...$sb], 'COALESCE(q.quote_date,DATE(e.created_at)) DESC,q.id DESC', $f);
        foreach ($res['items'] as &$i) { $i['item_count'] = (int) $i['item_count']; $i['awarded'] = (bool) $i['awarded']; }
        unset($i);
        $res['summary'] = [
            'statuses' => $this->facet('SELECT q.status_code AS code,COUNT(*) AS count FROM supplier_quotes q WHERE q.organization_id=? GROUP BY q.status_code ORDER BY count DESC', $org),
            'suppliers' => array_map(static fn ($r) => ['id' => $r['id'], 'code' => $r['code'], 'name' => $r['name'], 'total' => (int) $r['total'], 'awarded' => (int) $r['awarded'], 'active' => (int) $r['total'] - (int) $r['awarded']], $this->rows(
                "SELECT se.public_id AS id,s.code,s.legal_name AS name,COUNT(*) AS total,COALESCE(SUM({$awarded}),0) AS awarded FROM supplier_quotes q" . sprintf(self::SUP, 'q') . ' WHERE q.organization_id=? GROUP BY se.public_id,s.code,s.legal_name ORDER BY total DESC,s.legal_name LIMIT 500', [$org])),
        ];
        return $res;
    }

    /** Internal view of a supplier quote: header + priced items (Matriz interna de proveedores). */
    public function supplierQuote(int $org, string $id): ?array
    {
        $h = $this->rows('SELECT e.public_id AS id,q.id AS db_id,q.folio,q.supplier_reference,q.quote_date,q.valid_until,q.currency_code AS currency,q.subtotal_amount,q.tax_rate_pct,q.tax_amount,q.total_amount,q.lead_days,q.payment_terms,q.technical_score,q.document_score,q.notes,q.status_code AS status,q.legacy_status,
            r.folio AS requisition,c.legal_name AS client_name,s.legal_name AS supplier_name,s.code AS supplier_code
            FROM supplier_quotes q JOIN business_entities e ON e.id=q.id AND e.organization_id=q.organization_id' . sprintf(self::REQ, 'q') . sprintf(self::SUP, 'q') . ' WHERE q.organization_id=? AND e.public_id=? LIMIT 1', [$org, $id]);
        if (! $h) {
            return null;
        }
        $q = $h[0];
        $items = $this->rows('SELECT line_number,description,category_snapshot AS category,unit_label,requested_quantity,offered,quantity,unit_price,line_subtotal FROM supplier_quote_items WHERE organization_id=? AND supplier_quote_id=? ORDER BY line_number,id', [$org, (int) $q['db_id']]);
        foreach ($items as &$i) { $i['offered'] = (bool) $i['offered']; }
        unset($i, $q['db_id']);
        return ['item' => $q, 'items' => $items];
    }

    /** Without requisition: requisitions with supplier quotes. With requisition: items × offers (comparativo). */
    public function comparison(int $org, string $requisition): array
    {
        if ($requisition === 'all') {
            return ['requisitions' => array_map(static fn ($r) => ['id' => $r['id'], 'folio' => $r['folio'], 'client_name' => $r['client_name'], 'quotes' => (int) $r['quotes'], 'suppliers' => (int) $r['suppliers']], $this->rows(
                'SELECT re.public_id AS id,r.folio,c.legal_name AS client_name,COUNT(*) AS quotes,COUNT(DISTINCT q.supplier_id) AS suppliers FROM supplier_quotes q
                 JOIN requisitions r ON r.id=q.requisition_id AND r.organization_id=q.organization_id JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
                 JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id WHERE q.organization_id=? GROUP BY re.public_id,r.folio,c.legal_name ORDER BY r.folio LIMIT 1000', [$org]))];
        }
        $req = $this->rows('SELECT r.id,r.folio,c.legal_name AS client_name FROM requisitions r JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id WHERE r.organization_id=? AND re.public_id=? LIMIT 1', [$org, $requisition]);
        if (! $req) {
            return ['requisition' => null, 'lines' => [], 'offers' => []];
        }
        $rid = (int) $req[0]['id'];
        $lines = $this->rows('SELECT li.id,li.line_number,li.description,li.quantity,li.unit_label FROM requisition_items li WHERE li.organization_id=? AND li.requisition_id=? ORDER BY li.line_number,li.id LIMIT 500', [$org, $rid]);
        $offers = $this->rows("SELECT it.requisition_item_id AS line_id,qe.public_id AS quote_id,q.folio AS quote_folio,s.legal_name AS supplier_name,q.currency_code AS currency,it.offered,it.quantity,it.unit_price,it.line_subtotal,q.lead_days,q.status_code AS status,q.legacy_status,
              EXISTS (SELECT 1 FROM awards aw WHERE aw.organization_id=it.organization_id AND aw.requisition_item_id=it.requisition_item_id AND aw.supplier_quote_id=q.id AND aw.status_code='active' AND aw.superseded_at IS NULL) AS awarded
            FROM supplier_quote_items it JOIN supplier_quotes q ON q.id=it.supplier_quote_id AND q.organization_id=it.organization_id JOIN business_entities qe ON qe.id=q.id AND qe.organization_id=q.organization_id
            JOIN suppliers s ON s.id=q.supplier_id AND s.organization_id=q.organization_id WHERE it.organization_id=? AND it.requisition_id=? AND it.requisition_item_id IS NOT NULL ORDER BY it.requisition_item_id,it.unit_price", [$org, $rid]);
        $map = [];
        foreach ($lines as $l) { $map[(int) $l['id']] = ['line_number' => (int) $l['line_number'], 'description' => $l['description'], 'quantity' => $l['quantity'], 'unit_label' => $l['unit_label'], 'offers' => []]; }
        foreach ($offers as $o) {
            $k = (int) $o['line_id'];
            if (! isset($map[$k])) { continue; }
            unset($o['line_id']);
            $o['offered'] = (bool) $o['offered']; $o['awarded'] = (bool) $o['awarded'];
            $map[$k]['offers'][] = $o;
        }
        return ['requisition' => ['folio' => $req[0]['folio'], 'client_name' => $req[0]['client_name']], 'lines' => array_values($map)];
    }

    /** @param array{page:int,page_size:int,q:string,decision:string,client:string,scope:string} $f */
    public function customerQuotes(int $org, array $f): array
    {
        $from = 'FROM customer_quote_versions v JOIN business_entities e ON e.id=v.id AND e.organization_id=v.organization_id JOIN customer_quotes cq ON cq.id=v.customer_quote_id AND cq.organization_id=v.organization_id'
            . sprintf(self::REQ, 'v') . ' JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id';
        $latest = 'NOT EXISTS (SELECT 1 FROM customer_quote_versions nx WHERE nx.organization_id=v.organization_id AND nx.customer_quote_id=v.customer_quote_id AND nx.version_number>v.version_number)';
        $where = 'v.organization_id=?' . ($f['scope'] === 'current' ? ' AND ' . $latest : '');
        $binds = [$org];
        if ($f['decision'] !== 'all') { $where .= ' AND v.client_decision_status=?'; $binds[] = $f['decision']; }
        if ($f['client'] !== 'all') { $where .= ' AND ce.public_id=?'; $binds[] = $f['client']; }
        [$sq, $sb] = self::search($f['q'], ['v.folio', 'cq.series_reference', 'r.folio', 'c.legal_name', 'v.legacy_status']);
        $person = static fn (string $col): string => "(SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id={$col} AND u.organization_id=v.organization_id)";
        $res = $this->page("e.public_id AS id,v.folio,cq.series_reference AS series,v.version_number,v.quote_date,v.valid_until,v.currency_code AS currency,v.subtotal_amount,v.tax_amount,v.total_amount,
            v.document_status,v.internal_approval_status,v.client_decision_status,v.legacy_status,v.legacy_client_decision,v.service_fee_enabled,
            r.folio AS requisition,ce.public_id AS client_id,c.legal_name AS client_name,{$person('v.prepared_by')} AS prepared_by,{$person('v.approved_by')} AS approved_by,
            (SELECT COUNT(*) FROM customer_quote_versions x WHERE x.organization_id=v.organization_id AND x.customer_quote_id=v.customer_quote_id) AS versions,
            (SELECT d.decision_code FROM customer_quote_decisions d WHERE d.organization_id=v.organization_id AND d.customer_quote_version_id=v.id ORDER BY d.decision_at DESC,d.id DESC LIMIT 1) AS last_decision,
            (SELECT d.decision_at FROM customer_quote_decisions d WHERE d.organization_id=v.organization_id AND d.customer_quote_version_id=v.id ORDER BY d.decision_at DESC,d.id DESC LIMIT 1) AS last_decision_at",
            $from, $where . $sq, [...$binds, ...$sb], 'COALESCE(v.quote_date,DATE(e.created_at)) DESC,v.id DESC', $f);
        foreach ($res['items'] as &$i) { $i['version_number'] = (int) $i['version_number']; $i['versions'] = (int) $i['versions']; $i['service_fee_enabled'] = (bool) $i['service_fee_enabled']; }
        unset($i);
        $res['summary'] = [
            'decisions' => $this->facet("SELECT v.client_decision_status AS code,COUNT(*) AS count FROM customer_quote_versions v WHERE v.organization_id=? AND {$latest} GROUP BY v.client_decision_status ORDER BY count DESC", $org),
            'clients' => array_map(static fn ($r) => ['id' => $r['id'], 'name' => $r['name'], 'total' => (int) $r['total'], 'pending' => (int) $r['pending']], $this->rows(
                "SELECT ce.public_id AS id,c.legal_name AS name,COUNT(*) AS total,COALESCE(SUM(v.client_decision_status IN ('pending','sent','issued','awaiting','change_requested')),0) AS pending
                 FROM customer_quote_versions v JOIN requisitions r ON r.id=v.requisition_id AND r.organization_id=v.organization_id JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
                 JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id WHERE v.organization_id=? AND {$latest} GROUP BY ce.public_id,c.legal_name ORDER BY total DESC,c.legal_name", [$org])),
            'money' => array_map(static fn ($r) => ['currency' => $r['currency'], 'amount' => $r['amount'], 'quotes' => (int) $r['quotes']], $this->rows("SELECT v.currency_code AS currency,SUM(v.total_amount) AS amount,COUNT(*) AS quotes FROM customer_quote_versions v WHERE v.organization_id=? AND {$latest} GROUP BY v.currency_code ORDER BY v.currency_code", [$org])),
        ];
        return $res;
    }

    /** Client-facing quote version (no internal cost columns) + its decisions and the whole version history. */
    public function customerQuote(int $org, string $id): ?array
    {
        $h = $this->rows('SELECT e.public_id AS id,v.id AS db_id,v.customer_quote_id AS cq_id,v.folio,v.version_number,v.quote_date,v.valid_until,v.currency_code AS currency,v.subtotal_amount,v.discount_amount,v.tax_rate_pct,v.tax_amount,v.total_amount,
            v.service_fee_enabled,v.service_fee_total_amount,v.document_status,v.internal_approval_status,v.client_decision_status,v.legacy_status,v.delivery_place,v.lead_time_text,v.payment_terms,v.warranty_text,v.inclusions_text,v.exclusions_text,v.notes,
            r.folio AS requisition,c.legal_name AS client_name,c.tax_identifier AS client_tax_id,
            (SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=v.prepared_by AND u.organization_id=v.organization_id) AS prepared_by,
            (SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=v.reviewed_by AND u.organization_id=v.organization_id) AS reviewed_by,
            (SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=v.approved_by AND u.organization_id=v.organization_id) AS approved_by
            FROM customer_quote_versions v JOIN business_entities e ON e.id=v.id AND e.organization_id=v.organization_id' . sprintf(self::REQ, 'v') . ' WHERE v.organization_id=? AND e.public_id=? LIMIT 1', [$org, $id]);
        if (! $h) {
            return null;
        }
        $v = $h[0];
        $vid = (int) $v['db_id']; $cq = (int) $v['cq_id'];
        unset($v['db_id'], $v['cq_id']);
        $v['service_fee_enabled'] = (bool) $v['service_fee_enabled'];
        $items = $this->rows('SELECT line_number,description,brand_model,unit_label,quantity,unit_price,line_subtotal FROM customer_quote_items WHERE organization_id=? AND customer_quote_version_id=? ORDER BY line_number,id', [$org, $vid]);
        $decisions = $this->rows('SELECT d.decision_code,d.decision_at,d.decision_channel,d.note,d.provenance,(SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=d.actor_user_id AND u.organization_id=d.organization_id) AS actor
            FROM customer_quote_decisions d WHERE d.organization_id=? AND d.customer_quote_version_id=? ORDER BY d.decision_at,d.id', [$org, $vid]);
        $versions = $this->rows('SELECT e.public_id AS id,x.folio,x.version_number,x.quote_date,x.total_amount,x.currency_code AS currency,x.client_decision_status,x.document_status FROM customer_quote_versions x JOIN business_entities e ON e.id=x.id AND e.organization_id=x.organization_id WHERE x.organization_id=? AND x.customer_quote_id=? ORDER BY x.version_number', [$org, $cq]);
        return ['item' => $v, 'items' => $items, 'decisions' => $decisions, 'versions' => $versions];
    }

    /** Spanish status label of a client quote version: the original (imported) label wins; otherwise derived from codes. */
    private const STATUS_LABEL = "COALESCE(NULLIF(TRIM(v.legacy_status),''),CASE WHEN v.document_status IN ('superseded','cancelled') THEN 'Sustituida'
        WHEN v.client_decision_status='approved' THEN 'Aprobada' WHEN v.client_decision_status='rejected' THEN 'Rechazada'
        WHEN v.client_decision_status='change_requested' THEN 'Cambios solicitados'
        WHEN v.document_status='draft' AND v.internal_approval_status='approved' THEN 'Autorizada internamente' WHEN v.document_status='draft' THEN 'Borrador'
        WHEN v.document_status IN ('issued','sent') THEN 'Enviada al cliente' WHEN v.internal_approval_status='approved' THEN 'Autorizada internamente' ELSE v.document_status END)";
    /** pending | approved | closed (superseded, cancelled or rejected) — filter groups of the original design. */
    private const STATUS_GROUP = "CASE WHEN v.document_status IN ('superseded','cancelled') OR v.client_decision_status IN ('rejected','cancelled') THEN 'closed'
        WHEN v.client_decision_status='approved' THEN 'approved' ELSE 'pending' END";

    /**
     * "Revisiones / modificaciones": one row per client-quote family (customer_quotes) with its first (Rev. 0) and current
     * (Rev. N) versions, the linked Change Request and whether the signed-in Master Admin may file a controlled
     * modification (R3A) on the requisition. The eligibility mirrors RequisitionChangeRepository::create, which stays the
     * only authority; nothing is written here.
     *
     * @param array{page:int,page_size:int,q:string,status:string} $f
     */
    public function revisionFamilies(int $org, int $actor, array $f): array
    {
        $ver = static fn (string $order): string => "(SELECT x.id FROM customer_quote_versions x WHERE x.organization_id=cq.organization_id AND x.customer_quote_id=cq.id ORDER BY x.version_number {$order},x.id {$order} LIMIT 1)";
        $family = 'SELECT cq.id AS cq_id,cq.organization_id AS org_id,cq.series_reference,cq.requisition_id,cq.client_id,' . $ver('DESC') . ' AS cur_id,' . $ver('ASC') . ' AS first_id,
            (SELECT COUNT(*) FROM customer_quote_versions x WHERE x.organization_id=cq.organization_id AND x.customer_quote_id=cq.id) AS revisions,
            (SELECT COUNT(*) FROM customer_quote_versions x WHERE x.organization_id=cq.organization_id AND x.customer_quote_id=cq.id AND x.client_decision_status=\'approved\') AS approved_versions,
            COALESCE((SELECT x.change_request_id FROM customer_quote_versions x WHERE x.organization_id=cq.organization_id AND x.customer_quote_id=cq.id AND x.change_request_id IS NOT NULL ORDER BY x.version_number DESC,x.id DESC LIMIT 1),
              (SELECT k.id FROM requisition_change_requests k JOIN customer_quote_versions x ON x.id=k.resulting_customer_quote_version_id AND x.organization_id=k.organization_id
               WHERE k.organization_id=cq.organization_id AND x.customer_quote_id=cq.id ORDER BY x.version_number DESC,k.id DESC LIMIT 1)) AS cr_id
            FROM customer_quotes cq WHERE cq.organization_id=?';
        $from = "FROM ({$family}) fam JOIN customer_quotes cq ON cq.id=fam.cq_id AND cq.organization_id=fam.org_id JOIN business_entities qe ON qe.id=cq.id AND qe.organization_id=cq.organization_id
            JOIN customer_quote_versions v ON v.id=fam.cur_id AND v.organization_id=fam.org_id JOIN business_entities ve ON ve.id=v.id AND ve.organization_id=v.organization_id
            JOIN customer_quote_versions v0 ON v0.id=fam.first_id AND v0.organization_id=fam.org_id
            JOIN requisitions r ON r.id=cq.requisition_id AND r.organization_id=cq.organization_id JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
            JOIN clients c ON c.id=cq.client_id AND c.organization_id=cq.organization_id JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id
            LEFT JOIN requisition_change_requests cr ON cr.id=fam.cr_id AND cr.organization_id=fam.org_id";
        $label = self::STATUS_LABEL;
        $group = self::STATUS_GROUP;
        $where = '1=1';
        $binds = [$org];
        if ($f['status'] !== 'all') { $where .= " AND ({$group})=?"; $binds[] = $f['status']; }
        [$sq, $sb] = self::search($f['q'], ['v.folio', 'cq.series_reference', 'r.folio', 'c.legal_name', 'cr.folio', $label]);
        $pending = "(SELECT k.folio FROM requisition_change_requests k WHERE k.organization_id=r.organization_id AND k.requisition_id=r.id AND k.status_code='pending_review' ORDER BY k.id DESC LIMIT 1)";
        $rf1 = "EXISTS(SELECT 1 FROM requisition_revision_snapshots rs WHERE rs.organization_id=r.organization_id AND rs.requisition_id=r.id AND rs.provenance='system' AND rs.snapshot_schema_version=2
            AND JSON_UNQUOTE(JSON_EXTRACT(rs.snapshot_json,'$.origin'))='supplyflow_recovery_rf1')";
        $block = "CASE WHEN re.archived_at IS NOT NULL OR re.imported_at IS NOT NULL THEN 'imported' WHEN NOT {$rf1} THEN 'not_rf1' WHEN re.created_by<>? THEN 'not_owner'
            WHEN {$pending} IS NOT NULL THEN 'pending_change' ELSE NULL END";
        $total = (int) ($this->rows("SELECT COUNT(*) AS n {$from} WHERE {$where}{$sq}", [...$binds, ...$sb])[0]['n'] ?? 0);
        $items = $this->rows("SELECT qe.public_id AS id,cq.series_reference AS series,ve.public_id AS current_id,v.folio AS current_folio,COALESCE(v.legacy_revision_number,v.version_number-1) AS current_rev,
            v.version_number AS current_version,v.quote_date AS current_quote_date,v.valid_until,v.currency_code AS currency,v.total_amount AS current_total,v.document_status,v.internal_approval_status,
            v.client_decision_status,v.legacy_status,{$label} AS status_label,{$group} AS status_group,v0.folio AS rev0_folio,COALESCE(v0.legacy_revision_number,v0.version_number-1) AS rev0_rev,
            v0.total_amount AS rev0_total,v0.currency_code AS rev0_currency,fam.revisions,fam.approved_versions,r.folio AS requisition,re.public_id AS requisition_id,ce.public_id AS client_id,c.legal_name AS client_name,
            cr.folio AS change_request,cr.status_code AS change_request_status,cr.change_type AS change_request_type,cr.request_date AS change_request_date,{$pending} AS pending_change,{$block} AS change_block
            {$from} WHERE {$where}{$sq} ORDER BY COALESCE(v.quote_date,DATE(ve.created_at)) DESC,v.id DESC LIMIT ? OFFSET ?",
            [$actor, ...$binds, ...$sb, $f['page_size'], ($f['page'] - 1) * $f['page_size']]);
        foreach ($items as &$i) {
            foreach (['current_rev', 'current_version', 'rev0_rev', 'revisions', 'approved_versions'] as $k) { $i[$k] = (int) $i[$k]; }
            $i['can_request_change'] = $i['change_block'] === null;
        }
        unset($i);
        $s = $this->rows("SELECT COUNT(*) AS families,COALESCE(SUM(fam.revisions>1),0) AS with_rev_n,COALESCE(SUM(fam.approved_versions>0),0) AS approved,COALESCE(SUM(fam.cr_id IS NOT NULL),0) AS linked_cr,
            COALESCE(SUM(({$group})='pending'),0) AS pending,COALESCE(SUM(({$group})='approved'),0) AS current_approved,COALESCE(SUM(({$group})='closed'),0) AS closed
            FROM ({$family}) fam JOIN customer_quote_versions v ON v.id=fam.cur_id AND v.organization_id=fam.org_id", [$org])[0] ?? [];
        return ['items' => $items, 'total' => $total, 'page' => $f['page'], 'page_size' => $f['page_size'], 'summary' => array_map('intval', $s)];
    }

    /** @param array{page:int,page_size:int,q:string,status:string} $f */
    public function awards(int $org, array $f): array
    {
        $from = 'FROM awards aw' . sprintf(self::REQ, 'aw') . sprintf(self::SUP, 'aw') . ' JOIN supplier_quotes q ON q.id=aw.supplier_quote_id AND q.organization_id=aw.organization_id JOIN requisition_items li ON li.id=aw.requisition_item_id AND li.organization_id=aw.organization_id';
        $where = 'aw.organization_id=?';
        $binds = [$org];
        if ($f['status'] === 'current') { $where .= " AND aw.status_code='active' AND aw.superseded_at IS NULL"; }
        elseif ($f['status'] !== 'all') { $where .= ' AND aw.status_code=?'; $binds[] = $f['status']; }
        [$sq, $sb] = self::search($f['q'], ['r.folio', 's.legal_name', 'q.folio', 'li.description', 'c.legal_name']);
        $res = $this->page("aw.public_id AS id,r.folio AS requisition,c.legal_name AS client_name,li.line_number,li.description,s.legal_name AS supplier_name,q.folio AS quote_folio,aw.quantity,aw.unit_price,aw.subtotal_amount,aw.currency_code AS currency,aw.status_code AS status,aw.source_kind,aw.superseded_at,aw.created_at,
            (SELECT GROUP_CONCAT(DISTINCT po.folio ORDER BY po.folio SEPARATOR ', ') FROM purchase_order_requisitions pr JOIN purchase_orders po ON po.id=pr.purchase_order_id AND po.organization_id=pr.organization_id WHERE pr.organization_id=aw.organization_id AND pr.requisition_id=aw.requisition_id AND po.supplier_id=aw.supplier_id) AS purchase_orders",
            $from, $where . $sq, [...$binds, ...$sb], 'r.folio,li.line_number,aw.id', $f);
        $res['summary'] = $this->facet('SELECT aw.status_code AS code,COUNT(*) AS count FROM awards aw WHERE aw.organization_id=? GROUP BY aw.status_code ORDER BY count DESC', $org);
        return $res;
    }
}
