<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

/**
 * Gestión del Contratista · read-only (SELECT). Card 1 "Registro de validación": the internal validation of a requisition
 * before quoting (`requisition_reviews`: internal folio, purchasing manager, technical / contractual / budget result,
 * strategy, minimum quotes, quotation deadline, criteria and notes). Every query is scoped to the session organization;
 * archived requisitions are excluded. Registering a validation is NOT exposed (no write routes).
 */
final class ContractorManagementReadRepository
{
    private BaseConnection $db;

    public function __construct(?BaseConnection $connection = null)
    {
        $this->db = $connection ?? Database::connect();
    }

    /** @return list<array<string,mixed>> */
    private function rows(string $sql, array $binds = []): array
    {
        $q = $this->db->query($sql, $binds);
        if ($q === false) {
            throw new \RuntimeException('Query failed');
        }
        return $q->getResultArray();
    }

    private static function snapName(string $col): string
    {
        return "(CASE WHEN {$col} IS NULL OR NOT JSON_VALID({$col}) THEN NULL WHEN JSON_TYPE({$col})='STRING' THEN JSON_UNQUOTE({$col}) ELSE COALESCE(JSON_VALUE({$col},'$.name'),JSON_VALUE({$col},'$.display_name'),JSON_VALUE({$col},'$.nombre'),JSON_VALUE({$col},'$.fullName')) END)";
    }

    /** Buyer of a review: the user's person, else the imported snapshot. */
    private static function buyer(string $rv = 'rv'): string
    {
        $snap = self::snapName("{$rv}.buyer_snapshot");
        return "COALESCE((SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id={$rv}.buyer_user_id AND u.organization_id={$rv}.organization_id),{$snap})";
    }

    /** Downstream documents of a requisition (they mean the validation stage was already passed). */
    private const DOWNSTREAM = <<<'SQL'
        (SELECT COUNT(*) FROM rfqs f WHERE f.organization_id=r.organization_id AND f.requisition_id=r.id) AS rfq_count,
        (SELECT COUNT(*) FROM supplier_quotes q WHERE q.organization_id=r.organization_id AND q.requisition_id=r.id) AS quote_count,
        (SELECT COUNT(DISTINCT po.series_public_id) FROM purchase_order_requisitions pr JOIN purchase_orders po ON po.id=pr.purchase_order_id AND po.organization_id=pr.organization_id
           WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id) AS po_count
        SQL;

    /**
     * Requisitions to validate (selector) and purchasing managers (active personnel of the contractor = session
     * organization, the "Contratista → Personal / contactos" list).
     */
    public function setup(int $org): array
    {
        $down = self::DOWNSTREAM;
        $buyer = self::buyer();
        $reqs = $this->rows(<<<SQL
            SELECT e.public_id AS id,r.folio,r.project_reference_snapshot AS project,c.legal_name AS client_name,r.internal_reference,r.client_reference,
                   r.request_date,r.need_date,r.is_provisional,
                   (SELECT COUNT(*) FROM requisition_items ri WHERE ri.organization_id=r.organization_id AND ri.requisition_id=r.id AND ri.cancelled_at IS NULL) AS item_count,
                   (SELECT COUNT(*) FROM requisition_reviews rv WHERE rv.organization_id=r.organization_id AND rv.requisition_id=r.id) AS review_count,
                   (SELECT rv.id FROM requisition_reviews rv WHERE rv.organization_id=r.organization_id AND rv.requisition_id=r.id ORDER BY rv.id DESC LIMIT 1) AS last_review_id,
                   {$down}
            FROM requisitions r
            JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id
            JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            WHERE r.organization_id=? AND e.archived_at IS NULL
            ORDER BY COALESCE(r.request_date,'0000-01-01') DESC,r.id DESC
            LIMIT 1000
            SQL, [$org]);
        $ids = array_values(array_filter(array_map(static fn ($r) => $r['last_review_id'] === null ? null : (int) $r['last_review_id'], $reqs)));
        $last = [];
        if ($ids !== []) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            foreach ($this->rows("SELECT rv.id,rv.folio,rv.technical_result AS technical,rv.contract_result AS contract,rv.budget_result AS budget,rv.strategy,{$buyer} AS buyer FROM requisition_reviews rv WHERE rv.organization_id=? AND rv.id IN ({$in})", [$org, ...$ids]) as $v) {
                $last[(int) $v['id']] = array_diff_key($v, ['id' => true]);
            }
        }
        foreach ($reqs as &$r) {
            $r['is_provisional'] = $r['is_provisional'] === null ? null : (bool) $r['is_provisional'];
            $r['last_review'] = $r['last_review_id'] === null ? null : ($last[(int) $r['last_review_id']] ?? null);
            unset($r['last_review_id']);
            foreach (['item_count', 'review_count', 'rfq_count', 'quote_count', 'po_count'] as $k) {
                $r[$k] = (int) $r[$k];
            }
        }
        unset($r);
        $buyers = $this->rows(<<<'SQL'
            SELECT p.public_id AS id,p.display_name AS name,p.position_title AS position,p.email,
                   (u.id IS NOT NULL) AS has_user,(u.id IS NOT NULL AND u.access_enabled=1 AND u.status_code='active') AS with_access,
                   (SELECT GROUP_CONCAT(DISTINCT ro.name ORDER BY ro.name SEPARATOR ', ') FROM user_roles ur JOIN roles ro ON ro.id=ur.role_id AND ro.organization_id=ur.organization_id
                      WHERE ur.organization_id=u.organization_id AND ur.user_id=u.id) AS roles,
                   (SELECT COUNT(*) FROM requisition_reviews rv WHERE rv.organization_id=p.organization_id AND rv.buyer_user_id=u.id) AS review_count
            FROM people p LEFT JOIN users u ON u.person_id=p.id AND u.organization_id=p.organization_id
            WHERE p.organization_id=? AND p.active=1
            ORDER BY p.display_name,p.id
            LIMIT 500
            SQL, [$org]);
        foreach ($buyers as &$b) {
            $b['has_user'] = (bool) $b['has_user'];
            $b['with_access'] = (bool) $b['with_access'];
            $b['review_count'] = (int) $b['review_count'];
        }
        unset($b);
        $o = $this->rows('SELECT public_id,legal_name FROM organizations WHERE id=?', [$org])[0] ?? null;
        return ['requisitions' => $reqs, 'buyers' => $buyers, 'contractor' => $o ? ['id' => $o['public_id'], 'legal_name' => $o['legal_name']] : null,
            'summary' => ['requisitions' => count($reqs), 'with_review' => count(array_filter($reqs, static fn ($r) => $r['review_count'] > 0)), 'buyers' => count($buyers)]];
    }

    /** Requisition context for the validation: header, lines, registered validations and downstream documents. */
    public function requisition(int $org, string $id): ?array
    {
        $down = self::DOWNSTREAM;
        $r = $this->rows(<<<SQL
            SELECT r.id AS db_id,e.public_id AS id,r.folio,r.project_reference_snapshot AS project,c.legal_name AS client_name,r.internal_reference,r.client_reference,
                   r.request_date,r.need_date,r.priority_code AS priority,r.route_code AS route,r.budget_amount,r.currency_code AS currency,r.description,r.notes,
                   r.requester_name,r.delivery_place,r.is_provisional,r.regularization_status,r.change_status,{$down}
            FROM requisitions r
            JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id
            JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            WHERE r.organization_id=? AND e.public_id=? AND e.archived_at IS NULL
            SQL, [$org, $id])[0] ?? null;
        if (! $r) {
            return null;
        }
        $items = $this->rows(<<<'SQL'
            SELECT ri.line_number,ri.description,ri.quantity,ri.unit_label,COALESCE(ri.category_label_snapshot,cat.name) AS category
            FROM requisition_items ri LEFT JOIN categories cat ON cat.id=ri.category_id AND cat.organization_id=ri.organization_id
            WHERE ri.organization_id=? AND ri.requisition_id=? AND ri.cancelled_at IS NULL
            ORDER BY ri.line_number LIMIT 500
            SQL, [$org, $r['db_id']]);
        foreach ($items as &$i) {
            $i['line_number'] = (int) $i['line_number'];
            $i['quantity'] = (float) $i['quantity'];
        }
        unset($i);
        $buyer = self::buyer();
        $reviews = $this->rows(<<<SQL
            SELECT e.public_id AS id,rv.folio,{$buyer} AS buyer,rv.technical_result AS technical,rv.contract_result AS contract,rv.budget_result AS budget,
                   rv.strategy,rv.min_quotes,rv.deadline,rv.criteria,rv.notes,e.created_at
            FROM requisition_reviews rv JOIN business_entities e ON e.id=rv.id AND e.organization_id=rv.organization_id
            WHERE rv.organization_id=? AND rv.requisition_id=?
            ORDER BY rv.id DESC LIMIT 100
            SQL, [$org, $r['db_id']]);
        foreach ($reviews as &$v) {
            $v['min_quotes'] = (int) $v['min_quotes'];
        }
        unset($v);
        unset($r['db_id']);
        $r['budget_amount'] = $r['budget_amount'] === null ? null : (float) $r['budget_amount'];
        $r['is_provisional'] = $r['is_provisional'] === null ? null : (bool) $r['is_provisional'];
        foreach (['rfq_count', 'quote_count', 'po_count'] as $k) {
            $r[$k] = (int) $r[$k];
        }
        return ['item' => $r, 'items' => $items, 'reviews' => $reviews];
    }
    /** Latest validation per requisition (same rule as Cotizaciones: the newest requisition_reviews row). */
    private const LATEST_REVIEW = 'rv.organization_id=r.organization_id AND rv.requisition_id=r.id AND NOT EXISTS (SELECT 1 FROM requisition_reviews n WHERE n.organization_id=rv.organization_id AND n.requisition_id=rv.requisition_id AND n.id>rv.id)';

    /** Supplier catalog for lots: status, own category and the categories of its registered supplies (offerings). */
    private function supplierCatalog(int $org): array
    {
        $rows = $this->rows(<<<'SQL'
            SELECT se.public_id AS id,s.code,s.legal_name AS name,s.status_code AS status,s.legacy_status,COALESCE(c.name,s.legacy_category_label) AS category,
                   (SELECT GROUP_CONCAT(DISTINCT COALESCE(oc.name,o.legacy_category_label) ORDER BY COALESCE(oc.name,o.legacy_category_label) SEPARATOR '||') FROM supplier_offerings o
                      LEFT JOIN categories oc ON oc.id=o.category_id AND oc.organization_id=o.organization_id
                      WHERE o.organization_id=s.organization_id AND o.supplier_id=s.id AND COALESCE(oc.name,o.legacy_category_label) IS NOT NULL) AS offering_categories
            FROM suppliers s JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id
            LEFT JOIN categories c ON c.id=s.category_id AND c.organization_id=s.organization_id
            WHERE s.organization_id=? AND se.archived_at IS NULL
            ORDER BY s.legal_name,s.id
            SQL, [$org]);
        foreach ($rows as &$x) {
            $x['offering_categories'] = $x['offering_categories'] === null ? [] : explode('||', (string) $x['offering_categories']);
        }
        unset($x);
        return $rows;
    }

    /** Card 2 setup: validated requisitions (latest validation) and the supplier catalog. */
    public function strategySetup(int $org): array
    {
        $buyer = self::buyer();
        $latest = self::LATEST_REVIEW;
        $reqs = $this->rows(<<<SQL
            SELECT e.public_id AS id,r.folio,c.legal_name AS client_name,r.project_reference_snapshot AS project,r.contract_reference_snapshot AS contract,
                   rv.folio AS review_folio,{$buyer} AS buyer,rv.technical_result AS technical,rv.contract_result AS contract_result,rv.budget_result AS budget,rv.strategy,rv.min_quotes,
                   (SELECT COUNT(*) FROM requisition_items ri WHERE ri.organization_id=r.organization_id AND ri.requisition_id=r.id AND ri.cancelled_at IS NULL) AS item_count,
                   (SELECT COUNT(*) FROM rfqs f WHERE f.organization_id=r.organization_id AND f.requisition_id=r.id) AS rfq_count,
                   (SELECT COUNT(*) FROM sourcing_plans sp WHERE sp.organization_id=r.organization_id AND sp.requisition_id=r.id) AS plan_count,
                   EXISTS(SELECT 1 FROM purchase_order_requisitions pr WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id) AS has_po
            FROM requisition_reviews rv
            JOIN requisitions r ON r.id=rv.requisition_id AND r.organization_id=rv.organization_id
            JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id
            JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            WHERE rv.organization_id=? AND e.archived_at IS NULL AND {$latest}
            ORDER BY has_po,COALESCE(r.request_date,'0000-01-01') DESC,r.id DESC
            LIMIT 1000
            SQL, [$org]);
        foreach ($reqs as &$r) {
            foreach (['min_quotes', 'item_count', 'rfq_count', 'plan_count'] as $k) {
                $r[$k] = (int) $r[$k];
            }
            $r['has_po'] = (bool) $r['has_po'];
        }
        unset($r);
        $suppliers = $this->supplierCatalog($org);
        $authorized = count(array_filter($suppliers, static fn ($x) => in_array($x['status'], ['authorized', 'active'], true)));
        $available = count(array_filter($suppliers, static fn ($x) => ! in_array($x['status'], ['suspended', 'inactive', 'blocked'], true)));
        return ['requisitions' => $reqs, 'suppliers' => $suppliers,
            'summary' => ['requisitions' => count($reqs), 'suppliers' => count($suppliers), 'authorized' => $authorized, 'available' => $available]];
    }

    /** Card 2 detail: validated requisition, its active lines (with RFQs already sent), latest sourcing plan and RFQs per lot. */
    public function strategyRequisition(int $org, string $id): ?array
    {
        $buyer = self::buyer();
        $latest = self::LATEST_REVIEW;
        $r = $this->rows(<<<SQL
            SELECT r.id AS db_id,e.public_id AS id,r.folio,c.legal_name AS client_name,r.project_reference_snapshot AS project,r.contract_reference_snapshot AS contract,
                   r.need_date,r.currency_code AS currency,rv.folio AS review_folio,{$buyer} AS buyer,rv.technical_result AS technical,rv.contract_result AS contract_result,
                   rv.budget_result AS budget,rv.strategy,rv.min_quotes,rv.deadline AS review_deadline,
                   EXISTS(SELECT 1 FROM purchase_order_requisitions pr WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id) AS has_po
            FROM requisition_reviews rv
            JOIN requisitions r ON r.id=rv.requisition_id AND r.organization_id=rv.organization_id
            JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id
            JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            WHERE rv.organization_id=? AND e.public_id=? AND e.archived_at IS NULL AND {$latest}
            SQL, [$org, $id])[0] ?? null;
        if (! $r) {
            return null;
        }
        $rid = (int) $r['db_id'];
        unset($r['db_id']);
        $r['min_quotes'] = (int) $r['min_quotes'];
        $r['has_po'] = (bool) $r['has_po'];
        $items = $this->rows(<<<'SQL'
            SELECT ri.id AS db_id,ri.public_id AS id,ri.line_number,ri.description,COALESCE(ri.category_label_snapshot,cat.name) AS category,ri.quantity,ri.unit_label AS unit,
                   ri.history_based,ri.repeat_sourcing_mode,ri.fixed_client_price
            FROM requisition_items ri LEFT JOIN categories cat ON cat.id=ri.category_id AND cat.organization_id=ri.organization_id
            WHERE ri.organization_id=? AND ri.requisition_id=? AND ri.cancelled_at IS NULL
            ORDER BY ri.line_number,ri.id LIMIT 500
            SQL, [$org, $rid]);
        $sent = [];
        foreach ($this->rows(<<<'SQL'
            SELECT it.requisition_item_id AS item,f.folio,s.legal_name AS supplier_name FROM rfq_items it
            JOIN rfqs f ON f.id=it.rfq_id AND f.organization_id=it.organization_id JOIN suppliers s ON s.id=f.supplier_id AND s.organization_id=f.organization_id
            WHERE it.organization_id=? AND it.requisition_id=? AND it.requisition_item_id IS NOT NULL ORDER BY f.folio
            SQL, [$org, $rid]) as $x) {
            $sent[(int) $x['item']][] = ['rfq' => $x['folio'], 'supplier_name' => $x['supplier_name']];
        }
        $byDb = [];
        foreach ($items as &$i) {
            $byDb[(int) $i['db_id']] = $i['id'];
            $i['sent'] = $sent[(int) $i['db_id']] ?? [];
            unset($i['db_id']);
            $i['line_number'] = (int) $i['line_number'];
            $i['quantity'] = (float) $i['quantity'];
            foreach (['history_based', 'fixed_client_price'] as $k) {
                $i[$k] = $i[$k] === null ? null : (bool) $i[$k];
            }
        }
        unset($i);
        $plan = $this->rows('SELECT id,version_number,min_quotes,updated_at FROM sourcing_plans WHERE organization_id=? AND requisition_id=? ORDER BY version_number DESC LIMIT 1', [$org, $rid])[0] ?? null;
        $lots = [];
        $lotKey = [];
        if ($plan) {
            foreach ($this->rows('SELECT id,name,min_quotes FROM sourcing_lots WHERE organization_id=? AND sourcing_plan_id=? ORDER BY id', [$org, $plan['id']]) as $n => $l) {
                $lotKey[(int) $l['id']] = 'L' . ($n + 1);
                $lots[(int) $l['id']] = ['key' => 'L' . ($n + 1), 'name' => $l['name'], 'min_quotes' => (int) $l['min_quotes'], 'items' => [], 'suppliers' => [], 'rfqs' => []];
            }
            if ($lots !== []) {
                $in = implode(',', array_fill(0, count($lots), '?'));
                foreach ($this->rows("SELECT sourcing_lot_id AS lot,requisition_item_id AS item,strategy FROM sourcing_lot_items WHERE organization_id=? AND sourcing_lot_id IN ({$in})", [$org, ...array_keys($lots)]) as $x) {
                    if (isset($byDb[(int) $x['item']])) {
                        $lots[(int) $x['lot']]['items'][] = ['id' => $byDb[(int) $x['item']], 'strategy' => $x['strategy']];
                    }
                }
                foreach ($this->rows("SELECT ls.sourcing_lot_id AS lot,se.public_id AS id,ls.selected,ls.suggested FROM sourcing_lot_suppliers ls JOIN business_entities se ON se.id=ls.supplier_id AND se.organization_id=ls.organization_id WHERE ls.organization_id=? AND ls.sourcing_lot_id IN ({$in})", [$org, ...array_keys($lots)]) as $x) {
                    $lots[(int) $x['lot']]['suppliers'][] = ['id' => $x['id'], 'selected' => (bool) $x['selected'], 'suggested' => (bool) $x['suggested']];
                }
            }
        }
        $loose = [];
        foreach ($this->rows(<<<'SQL'
            SELECT f.sourcing_lot_id AS lot,f.folio,se.public_id AS supplier_id,s.legal_name AS supplier_name,f.status_code AS status,f.legacy_status
            FROM rfqs f JOIN suppliers s ON s.id=f.supplier_id AND s.organization_id=f.organization_id JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id
            WHERE f.organization_id=? AND f.requisition_id=? ORDER BY f.folio
            SQL, [$org, $rid]) as $f) {
            $row = ['folio' => $f['folio'], 'supplier_id' => $f['supplier_id'], 'supplier_name' => $f['supplier_name'], 'status' => $f['status'], 'legacy_status' => $f['legacy_status']];
            if ($f['lot'] !== null && isset($lots[(int) $f['lot']])) {
                $lots[(int) $f['lot']]['rfqs'][] = $row;
            } else {
                $loose[] = $row + ['lot' => $f['lot'] !== null ? ($lotKey[(int) $f['lot']] ?? 'other_plan') : null];
            }
        }
        return ['item' => $r, 'items' => $items,
            'plan' => $plan ? ['version' => (int) $plan['version_number'], 'min_quotes' => (int) $plan['min_quotes'], 'updated_at' => $plan['updated_at'], 'lots' => array_values($lots)] : null,
            'rfqs_without_lot' => $loose];
    }
    /** "Can move to quoting" rule of Reglas inteligentes (Spanish or English values; collation is case/accent-insensitive). */
    private const CAN_QUOTE = "(rv.technical_result IN ('Conforme','Con observaciones','compliant','with observations') AND rv.contract_result IN ('Conforme','Con observaciones','compliant','with observations') AND rv.budget_result IN ('Disponible','Parcial','available','partial'))";

    /**
     * Card 3 "Matriz de validaciones": every internal validation with its requisition, purchasing manager (cards by manager:
     * key = user public id, a hash of the imported name, or "unassigned"), results, strategy and the "can quote" verdict.
     * @param array{buyer:string,q:string,page:int,page_size:int} $f
     */
    public function validations(int $org, array $f): array
    {
        $snap = self::snapName('rv.buyer_snapshot');
        $person = "(SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=rv.buyer_user_id AND u.organization_id=rv.organization_id)";
        $can = self::CAN_QUOTE;
        $base = <<<SQL
            SELECT rv.id AS rv_id,e.public_id AS id,rv.folio,re.public_id AS requisition_id,r.folio AS requisition,r.client_reference,r.internal_reference,c.legal_name AS client_name,
                   r.project_reference_snapshot AS project,COALESCE({$person},{$snap}) AS buyer,
                   (SELECT p.public_id FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=rv.buyer_user_id AND u.organization_id=rv.organization_id) AS buyer_person_id,
                   CASE WHEN rv.buyer_user_id IS NOT NULL THEN CONVERT((SELECT u.public_id FROM users u WHERE u.id=rv.buyer_user_id AND u.organization_id=rv.organization_id) USING utf8mb4)
                        WHEN {$snap} IS NOT NULL AND TRIM({$snap})<>'' THEN CONCAT('legacy-',LEFT(SHA2(TRIM({$snap}),256),16)) ELSE 'unassigned' END AS buyer_key,
                   rv.technical_result AS technical,rv.contract_result AS contract,rv.budget_result AS budget,rv.strategy,rv.min_quotes,rv.deadline,rv.criteria,rv.notes,
                   e.created_at,(e.imported_at IS NOT NULL OR e.legacy_id IS NOT NULL) AS imported,{$can} AS can_quote,
                   NOT EXISTS (SELECT 1 FROM requisition_reviews n WHERE n.organization_id=rv.organization_id AND n.requisition_id=rv.requisition_id AND n.id>rv.id) AS latest,
                   (SELECT COUNT(*) FROM rfqs fq WHERE fq.organization_id=r.organization_id AND fq.requisition_id=r.id) AS rfq_count,
                   (SELECT COUNT(*) FROM supplier_quotes q WHERE q.organization_id=r.organization_id AND q.requisition_id=r.id) AS quote_count,
                   (SELECT COUNT(DISTINCT po.series_public_id) FROM purchase_order_requisitions pr JOIN purchase_orders po ON po.id=pr.purchase_order_id AND po.organization_id=pr.organization_id
                      WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id) AS po_count
            FROM requisition_reviews rv
            JOIN business_entities e ON e.id=rv.id AND e.organization_id=rv.organization_id
            JOIN requisitions r ON r.id=rv.requisition_id AND r.organization_id=rv.organization_id
            JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
            JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            WHERE rv.organization_id=? AND e.archived_at IS NULL AND re.archived_at IS NULL
            SQL;
        $buyers = $this->rows("SELECT V.buyer_key AS `key`,MAX(V.buyer) AS name,COUNT(*) AS total,SUM(V.can_quote) AS can_quote FROM ({$base}) V GROUP BY V.buyer_key ORDER BY V.buyer_key='unassigned',name", [$org]);
        foreach ($buyers as &$b) {
            $b['total'] = (int) $b['total'];
            $b['can_quote'] = (int) $b['can_quote'];
            $b['blocked'] = $b['total'] - $b['can_quote'];
        }
        unset($b);
        $where = ''; $binds = [$org];
        if ($f['buyer'] !== 'all') {
            $where .= ' AND V.buyer_key=?';
            $binds[] = $f['buyer'];
        }
        if ($f['q'] !== '') {
            $l = '%' . strtr($f['q'], ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
            $where .= " AND (V.folio LIKE ? ESCAPE '!' OR V.requisition LIKE ? ESCAPE '!' OR V.client_reference LIKE ? ESCAPE '!' OR V.internal_reference LIKE ? ESCAPE '!' OR V.buyer LIKE ? ESCAPE '!' OR V.client_name LIKE ? ESCAPE '!' OR V.strategy LIKE ? ESCAPE '!')";
            array_push($binds, $l, $l, $l, $l, $l, $l, $l);
        }
        $total = (int) ($this->rows("SELECT COUNT(*) AS n FROM ({$base}) V WHERE 1=1{$where}", $binds)[0]['n'] ?? 0);
        $size = $f['page_size'];
        $off = ($f['page'] - 1) * $size;
        $items = $this->rows("SELECT V.* FROM ({$base}) V WHERE 1=1{$where} ORDER BY V.rv_id LIMIT {$size} OFFSET {$off}", $binds);
        foreach ($items as &$x) {
            unset($x['rv_id']);
            foreach (['min_quotes', 'rfq_count', 'quote_count', 'po_count'] as $k) {
                $x[$k] = (int) $x[$k];
            }
            foreach (['imported', 'can_quote', 'latest'] as $k) {
                $x[$k] = (bool) $x[$k];
            }
        }
        unset($x);
        $all = array_sum(array_column($buyers, 'total'));
        return ['items' => $items, 'total' => $total, 'page' => $f['page'], 'page_size' => $size,
            'summary' => ['validations' => $all, 'can_quote' => array_sum(array_column($buyers, 'can_quote')), 'blocked' => array_sum(array_column($buyers, 'blocked')), 'buyers' => $buyers]];
    }
}
