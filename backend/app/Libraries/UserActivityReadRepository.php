<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * Read-only user activity for the "Usuarios y roles" module, through the SELECT-only API account.
 * - functions(): operational roles OBSERVED in documents (buyer / preparer / authorizer / RFQ contact);
 *   they describe what is recorded, not a permission.
 * - events(): audit_events (append-only for application accounts) with server-side filters and paging.
 *   Values of sensitive-looking keys are never returned.
 */
final class UserActivityReadRepository
{
    private const SENSITIVE = '/pass|hash|token|secret|clave|contrase|cookie|session|sha256|digest/i';
    private const CRITICAL = 'delete|elimin|block|bloque|cancel|revok|reject|rechaz|deny|deneg|disable|suspend';

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
            throw new RuntimeException('USER_ACTIVITY_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    /** @return list<array<string,mixed>> */
    public function functions(int $org): array
    {
        $rows = $this->rows(<<<'SQL'
            SELECT u.public_id AS id,
              (SELECT COUNT(DISTINCT po.series_public_id) FROM purchase_orders po WHERE po.organization_id=u.organization_id AND po.buyer_user_id=u.id) AS po_buyer,
              (SELECT COUNT(DISTINCT po.series_public_id) FROM purchase_orders po WHERE po.organization_id=u.organization_id AND po.preparer_user_id=u.id) AS po_preparer,
              (SELECT COUNT(DISTINCT po.series_public_id) FROM purchase_orders po WHERE po.organization_id=u.organization_id AND po.authorizer_user_id=u.id) AS po_authorizer,
              (SELECT COUNT(*) FROM requisition_reviews rv WHERE rv.organization_id=u.organization_id AND rv.buyer_user_id=u.id) AS review_buyer,
              (SELECT COUNT(*) FROM rfqs f WHERE f.organization_id=u.organization_id AND f.internal_contact_user_id=u.id) AS rfq_contact,
              (SELECT COUNT(*) FROM audit_events ae WHERE ae.organization_id=u.organization_id AND ae.actor_user_id=u.id) AS audit_actions,
              (SELECT MAX(COALESCE(ae.occurred_at,ae.recorded_at)) FROM audit_events ae WHERE ae.organization_id=u.organization_id AND ae.actor_user_id=u.id) AS last_activity_at
            FROM users u WHERE u.organization_id=? ORDER BY u.id
            SQL, [$org]);
        return array_map(static function (array $r): array {
            foreach (['po_buyer', 'po_preparer', 'po_authorizer', 'review_buyer', 'rfq_contact', 'audit_actions'] as $k) {
                $r[$k] = (int) $r[$k];
            }
            return $r;
        }, $rows);
    }

    /**
     * @param array{from:string,to:string,actor:string,role:string,module:string,action:string,q:string} $f
     *        from/to are UTC 'Y-m-d H:i:s' bounds already validated by the controller.
     */
    public function events(int $org, array $f, int $page, int $size): array
    {
        $when = 'COALESCE(ae.occurred_at,ae.recorded_at)';
        $where = ['ae.organization_id=?'];
        $binds = [$org];
        if ($f['from'] !== '') { $where[] = "{$when}>=?"; $binds[] = $f['from']; }
        if ($f['to'] !== '') { $where[] = "{$when}<=?"; $binds[] = $f['to']; }
        if ($f['actor'] !== '') { $where[] = 'au.public_id=?'; $binds[] = $f['actor']; }
        if ($f['role'] !== '') {
            $where[] = 'EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.organization_id=ur.organization_id WHERE ur.organization_id=ae.organization_id AND ur.user_id=ae.actor_user_id AND r.code=?)';
            $binds[] = $f['role'];
        }
        if ($f['module'] !== '') { $where[] = 'ae.module_code=?'; $binds[] = $f['module']; }
        if ($f['action'] !== '') { $where[] = 'ae.action_code=?'; $binds[] = $f['action']; }
        if ($f['q'] !== '') {
            $fields = ['ae.action_code', 'ae.module_code', 'ae.detail_text', 'ap.display_name', 'au.login_email', 'ae.legacy_date_text', 'ae.legacy_record_reference'];
            $where[] = '(' . implode(' OR ', array_map(static fn (string $x): string => $x . " LIKE ? ESCAPE '!'", $fields)) . ')';
            $like = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $f['q']) . '%';
            foreach ($fields as $_) { $binds[] = $like; }
        }
        $from = ' FROM audit_events ae'
            . ' LEFT JOIN users au ON au.id=ae.actor_user_id AND au.organization_id=ae.organization_id'
            . ' LEFT JOIN people ap ON ap.id=au.person_id AND ap.organization_id=au.organization_id';
        $whereSql = ' WHERE ' . implode(' AND ', $where);
        $total = (int) ($this->rows('SELECT COUNT(*) AS n' . $from . $whereSql, $binds)[0]['n'] ?? 0);
        $items = $this->rows(<<<SQL
            SELECT ae.public_id AS id,ae.occurred_at,ae.recorded_at,ae.legacy_date_text,ae.module_code AS module,ae.action_code AS action,
              ae.result_code AS result,ae.detail_text AS detail,ae.source_kind,ae.legacy_record_reference,
              au.public_id AS actor_id,ap.display_name AS actor_name,au.login_email AS actor_email,
              JSON_UNQUOTE(COALESCE(JSON_EXTRACT(ae.actor_snapshot,'$.name'),JSON_EXTRACT(ae.actor_snapshot,'$.nombre'),JSON_EXTRACT(ae.actor_snapshot,'$.email'),JSON_EXTRACT(ae.actor_snapshot,'$.usuario'))) AS actor_snapshot_name,
              sp.display_name AS subject_user_name,be.entity_kind AS subject_kind,
              COALESCE((SELECT rq.folio FROM requisitions rq WHERE rq.id=ae.subject_entity_id AND rq.organization_id=ae.organization_id),
                       (SELECT c.legal_name FROM clients c WHERE c.id=ae.subject_entity_id AND c.organization_id=ae.organization_id),
                       (SELECT s.legal_name FROM suppliers s WHERE s.id=ae.subject_entity_id AND s.organization_id=ae.organization_id)) AS subject_label,
              ae.changes_json,ae.before_json,ae.after_json
            {$from}
              LEFT JOIN users su ON su.id=ae.subject_user_id AND su.organization_id=ae.organization_id
              LEFT JOIN people sp ON sp.id=su.person_id AND sp.organization_id=su.organization_id
              LEFT JOIN business_entities be ON be.id=ae.subject_entity_id AND be.organization_id=ae.organization_id
            {$whereSql} ORDER BY {$when} DESC,ae.id DESC LIMIT ? OFFSET ?
            SQL, [...$binds, $size, ($page - 1) * $size]);
        $items = array_map(static function (array $r): array {
            $r['changes'] = self::changes($r['changes_json'], $r['before_json'], $r['after_json']);
            unset($r['changes_json'], $r['before_json'], $r['after_json']);
            return $r;
        }, $items);
        $critical = "(ae.action_code REGEXP '" . self::CRITICAL . "' OR (ae.result_code IS NOT NULL AND ae.result_code NOT IN ('success','ok')))";
        $summary = $this->rows(
            "SELECT COUNT(*) AS total,COALESCE(SUM({$when}>=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 24 HOUR)),0) AS last_24h,"
            . 'COUNT(DISTINCT ae.actor_user_id) AS actors,COALESCE(SUM(' . $critical . '),0) AS critical'
            . ' FROM audit_events ae WHERE ae.organization_id=?', [$org])[0] ?? [];
        foreach ($summary as $k => $v) { $summary[$k] = (int) $v; }
        $facet = static fn (array $r): array => ['code' => (string) $r['code'], 'count' => (int) $r['count']];
        return [
            'items' => $items, 'total' => $total, 'page' => $page, 'page_size' => $size,
            'summary' => $summary,
            'facets' => [
                'modules' => array_map($facet, $this->rows('SELECT ae.module_code AS code,COUNT(*) AS count FROM audit_events ae WHERE ae.organization_id=? AND ae.module_code IS NOT NULL GROUP BY ae.module_code ORDER BY ae.module_code', [$org])),
                'actions' => array_map($facet, $this->rows('SELECT ae.action_code AS code,COUNT(*) AS count FROM audit_events ae WHERE ae.organization_id=? GROUP BY ae.action_code ORDER BY ae.action_code LIMIT 300', [$org])),
            ],
            'notes' => [
                'Fechas en UTC; la interfaz las muestra en la hora local del navegador.',
                'Las cuentas de la aplicación solo pueden agregar eventos; no tienen permiso para modificarlos ni eliminarlos.',
                'Los valores de campos sensibles (contraseñas, hashes, tokens) nunca se devuelven.',
            ],
        ];
    }

    /** @return list<array{field:string,before:?string,after:?string,value:?string}> at most 12 entries, values truncated and redacted. */
    private static function changes(?string $changes, ?string $before, ?string $after): array
    {
        $text = static function ($v): ?string {
            if ($v === null) { return null; }
            $s = is_scalar($v) ? (is_bool($v) ? ($v ? 'true' : 'false') : (string) $v) : (string) json_encode($v, JSON_UNESCAPED_UNICODE);
            return mb_strlen($s, 'UTF-8') > 160 ? mb_substr($s, 0, 157, 'UTF-8') . '…' : $s;
        };
        $guard = static fn (string $k, $v) => preg_match(self::SENSITIVE, $k) ? '[protegido]' : $text($v);
        $decode = static function (?string $j): ?array { $d = $j === null ? null : json_decode($j, true); return is_array($d) ? $d : null; };
        $out = [];
        $c = $decode($changes);
        if ($c !== null && array_is_list($c) === false) {
            foreach ($c as $k => $v) {
                $k = (string) $k;
                if (is_array($v) && (array_key_exists('before', $v) || array_key_exists('after', $v))) {
                    $out[] = ['field' => $k, 'before' => $guard($k, $v['before'] ?? null), 'after' => $guard($k, $v['after'] ?? null), 'value' => null];
                } else {
                    $out[] = ['field' => $k, 'before' => null, 'after' => null, 'value' => $guard($k, $v)];
                }
            }
        } else {
            $b = $decode($before) ?? []; $a = $decode($after) ?? [];
            foreach (array_unique([...array_keys($b), ...array_keys($a)]) as $k) {
                $k = (string) $k;
                if (($b[$k] ?? null) !== ($a[$k] ?? null)) {
                    $out[] = ['field' => $k, 'before' => $guard($k, $b[$k] ?? null), 'after' => $guard($k, $a[$k] ?? null), 'value' => null];
                }
            }
        }
        return array_slice($out, 0, 12);
    }
}
