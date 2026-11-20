<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

/**
 * Requisiciones › Control de cambios · read-only (SELECT, cuenta API). Complementa los GET de R3, que por diseño solo
 * muestran al solicitante sus propias solicitudes y al revisor las de otros:
 *  - overview(): historial completo de solicitudes de cambio de la organización (incluidas las importadas) con quién
 *    solicitó, quién resolvió y qué acción le corresponde al usuario de la sesión; KPI del tablero.
 *  - candidates(): requisiciones y si admiten una solicitud R3A, con el mismo criterio que
 *    RequisitionChangeRepository::create (que sigue siendo la única autoridad al escribir).
 * No escribe nada: crear, retirar, aprobar o rechazar siguen en RequisitionChangeController (cuenta recovery, CSRF,
 * If-Match, Idempotency-Key, auditoría).
 */
final class RequisitionChangeReadRepository
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

    public const STATUSES = ['pending_review', 'applied', 'rejected', 'withdrawn'];

    private const RF1 ="EXISTS(SELECT 1 FROM requisition_revision_snapshots rs WHERE rs.organization_id=r.organization_id AND rs.requisition_id=r.id
        AND rs.provenance='system' AND rs.snapshot_schema_version=2 AND JSON_UNQUOTE(JSON_EXTRACT(rs.snapshot_json,'$.origin'))='supplyflow_recovery_rf1')";

    private static function person(string $userCol): string
    {
        return "(SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id={$userCol} AND u.organization_id=cr.organization_id)";
    }

    private static function like(string $q): string
    {
        return '%' . strtr(mb_strtolower($q, 'UTF-8'), ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
    }

    /** One row per change request with every computed column (derived table V). ? = actor (three times). */
    private static function base(): string
    {
        $rf1 = self::RF1;
        $requester = self::person('ce.created_by');
        $resolver = self::person('ce.updated_by');
        return <<<SQL
            SELECT cr.id AS change_db_id,ce.public_id AS id,ce.row_version AS version,cr.folio,cr.status_code,cr.legacy_status,
                   re.public_id AS requisition_id,r.folio AS requisition_folio,c.legal_name AS client,c.code AS client_code,
                   cr.previous_revision_number,cr.new_revision_number,r.current_revision_number,cr.request_date,
                   cr.requested_by_snapshot AS requested_by,cr.source_label AS source,cr.change_type,cr.reference_text AS reference,
                   cr.reason,cr.impact_text AS impact,cr.requires_sourcing,cr.requires_supplier_confirmation,
                   ce.created_at,ce.updated_at,
                   (ce.imported_at IS NOT NULL OR re.imported_at IS NOT NULL) AS imported,
                   (ce.created_by=?) AS mine,
                   {$requester} AS requester_name,
                   CASE WHEN cr.status_code IN ('applied','rejected','withdrawn') AND ce.imported_at IS NULL THEN {$resolver} END AS resolved_by,
                   CASE WHEN cr.status_code IN ('applied','rejected','withdrawn') AND ce.imported_at IS NULL THEN ce.updated_at END AS resolved_at,
                   (SELECT COUNT(*) FROM requisition_change_items ci WHERE ci.organization_id=cr.organization_id AND ci.change_request_id=cr.id) AS change_count,
                   (cr.status_code='pending_review' AND ce.created_by<>? AND re.imported_at IS NULL AND re.archived_at IS NULL AND {$rf1}) AS reviewable,
                   (cr.status_code='pending_review' AND re.created_by=? AND re.imported_at IS NULL AND re.archived_at IS NULL AND {$rf1}) AS withdrawable
            FROM requisition_change_requests cr
            JOIN business_entities ce ON ce.id=cr.id AND ce.organization_id=cr.organization_id AND ce.entity_kind='requisition_change_request'
            JOIN requisitions r ON r.id=cr.requisition_id AND r.organization_id=cr.organization_id
            JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id AND re.entity_kind='requisition'
            LEFT JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            WHERE cr.organization_id=? AND ce.archived_at IS NULL
            SQL;
    }

    private static function format(array $r): array
    {
        unset($r['change_db_id']);
        foreach (['version', 'previous_revision_number', 'new_revision_number', 'current_revision_number', 'change_count'] as $k) {
            $r[$k] = $r[$k] === null ? null : (int) $r[$k];
        }
        foreach (['requires_sourcing', 'requires_supplier_confirmation', 'imported', 'mine', 'reviewable', 'withdrawable'] as $k) {
            $r[$k] = (bool) $r[$k];
        }
        return $r;
    }

    /**
     * @param array{status:string,scope:string,q:string,page:int,page_size:int} $f
     *   status: all|pending_review|applied|rejected|withdrawn|closed (rejected+withdrawn) · scope: all|mine|review|imported
     */
    public function overview(int $org, int $actor, array $f): array
    {
        $binds = [$actor, $actor, $actor, $org];
        $all = $this->rows('SELECT V.status_code,V.mine,V.reviewable,V.imported FROM (' . self::base() . ') V', $binds);
        $k = ['total' => count($all), 'pending_review' => 0, 'applied' => 0, 'rejected' => 0, 'withdrawn' => 0, 'other' => 0,
              'mine_pending' => 0, 'to_review' => 0, 'imported' => 0];
        foreach ($all as $r) {
            $s = (string) $r['status_code'];
            in_array($s, self::STATUSES, true) ? $k[$s]++ : $k['other']++;
            if ($s === 'pending_review' && (int) $r['mine'] === 1) {
                $k['mine_pending']++;
            }
            if ((int) $r['reviewable'] === 1) {
                $k['to_review']++;
            }
            if ((int) $r['imported'] === 1) {
                $k['imported']++;
            }
        }
        $w = '';
        $wb = [];
        if ($f['status'] === 'closed') {
            $w .= " AND V.status_code IN ('rejected','withdrawn')";
        } elseif ($f['status'] !== 'all') {
            $w .= ' AND V.status_code=?';
            $wb[] = $f['status'];
        }
        if ($f['scope'] === 'mine') {
            $w .= ' AND V.mine=1';
        } elseif ($f['scope'] === 'review') {
            $w .= ' AND V.reviewable=1';
        } elseif ($f['scope'] === 'imported') {
            $w .= ' AND V.imported=1';
        }
        if ($f['q'] !== '') {
            $l = self::like($f['q']);
            $cols = ['V.folio', 'V.requisition_folio', 'V.client', 'V.client_code', 'V.change_type', 'V.requested_by', 'V.requester_name', 'V.reference'];
            $w .= ' AND (' . implode(' OR ', array_map(static fn ($c) => "LOWER({$c}) LIKE ? ESCAPE '!'", $cols)) . ')';
            array_push($wb, ...array_fill(0, count($cols), $l));
        }
        $count = (int) ($this->rows('SELECT COUNT(*) AS n FROM (' . self::base() . ') V WHERE 1=1' . $w, [...$binds, ...$wb])[0]['n'] ?? 0);
        $pages = max(1, (int) ceil($count / $f['page_size']));
        $page = min($f['page'], $pages);
        $rows = $this->rows('SELECT V.* FROM (' . self::base() . ') V WHERE 1=1' . $w
            . ' ORDER BY (V.status_code=\'pending_review\') DESC,V.change_db_id DESC LIMIT ' . (int) $f['page_size'] . ' OFFSET ' . (int) (($page - 1) * $f['page_size']),
            [...$binds, ...$wb]);
        return ['kpis' => $k, 'items' => array_map(self::format(...), $rows), 'total' => $count, 'page' => $page,
            'page_size' => $f['page_size'], 'pages' => $pages, 'read_only' => true];
    }

    /**
     * Requisitions and whether an R3A request can be filed by the session user.
     * change_block mirrors RequisitionChangeRepository::create: imported | not_rf1 | not_owner | pending_change | null.
     * @param array{scope:string,q:string,page:int,page_size:int} $f scope: eligible|all
     */
    public function candidates(int $org, int $actor, array $f): array
    {
        $rf1 = self::RF1;
        $pending = "(SELECT k.folio FROM requisition_change_requests k WHERE k.organization_id=r.organization_id AND k.requisition_id=r.id AND k.status_code='pending_review' ORDER BY k.id DESC LIMIT 1)";
        $last = "(SELECT k.id FROM requisition_change_requests k WHERE k.organization_id=r.organization_id AND k.requisition_id=r.id ORDER BY k.id DESC LIMIT 1)";
        $base = <<<SQL
            SELECT r.id AS db_id,re.public_id AS id,re.row_version AS version,r.folio,c.legal_name AS client,c.code AS client_code,
                   r.current_revision_number,r.request_date,r.need_date,r.delivery_place,r.project_reference_snapshot AS project,
                   (SELECT COUNT(*) FROM requisition_items i WHERE i.organization_id=r.organization_id AND i.requisition_id=r.id AND i.line_status='active') AS line_count,
                   {$pending} AS pending_change,
                   (SELECT k.folio FROM requisition_change_requests k WHERE k.id={$last}) AS last_change,
                   (SELECT k.status_code FROM requisition_change_requests k WHERE k.id={$last}) AS last_change_status,
                   CASE WHEN re.imported_at IS NOT NULL THEN 'imported' WHEN NOT {$rf1} THEN 'not_rf1' WHEN re.created_by<>? THEN 'not_owner'
                        WHEN {$pending} IS NOT NULL THEN 'pending_change' ELSE NULL END AS change_block
            FROM requisitions r
            JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id AND re.entity_kind='requisition'
            LEFT JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            WHERE r.organization_id=? AND re.archived_at IS NULL
            SQL;
        $binds = [$actor, $org];
        $counts = $this->rows('SELECT COUNT(*) AS total,SUM(V.change_block IS NULL) AS eligible FROM (' . $base . ') V', $binds)[0] ?? [];
        $w = '';
        $wb = [];
        if ($f['scope'] === 'eligible') {
            $w .= ' AND V.change_block IS NULL';
        }
        if ($f['q'] !== '') {
            $l = self::like($f['q']);
            $cols = ['V.folio', 'V.client', 'V.client_code', 'V.project', 'V.delivery_place'];
            $w .= ' AND (' . implode(' OR ', array_map(static fn ($c) => "LOWER({$c}) LIKE ? ESCAPE '!'", $cols)) . ')';
            array_push($wb, ...array_fill(0, count($cols), $l));
        }
        $count = (int) ($this->rows('SELECT COUNT(*) AS n FROM (' . $base . ') V WHERE 1=1' . $w, [...$binds, ...$wb])[0]['n'] ?? 0);
        $pages = max(1, (int) ceil($count / $f['page_size']));
        $page = min($f['page'], $pages);
        $rows = $this->rows('SELECT V.* FROM (' . $base . ') V WHERE 1=1' . $w
            . ' ORDER BY (V.change_block IS NULL) DESC,V.db_id DESC LIMIT ' . (int) $f['page_size'] . ' OFFSET ' . (int) (($page - 1) * $f['page_size']),
            [...$binds, ...$wb]);
        foreach ($rows as &$r) {
            unset($r['db_id']);
            foreach (['version', 'current_revision_number', 'line_count'] as $k) {
                $r[$k] = (int) $r[$k];
            }
            $r['can_request_change'] = $r['change_block'] === null;
        }
        unset($r);
        return ['items' => $rows, 'total' => $count, 'page' => $page, 'page_size' => $f['page_size'], 'pages' => $pages,
            'counts' => ['total' => (int) ($counts['total'] ?? 0), 'eligible' => (int) ($counts['eligible'] ?? 0)], 'read_only' => true];
    }
}
