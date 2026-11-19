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
}
