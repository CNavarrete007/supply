<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Database\SessionContract;
use mysqli;
use mysqli_result;
use RuntimeException;
use Throwable;

/**
 * Gestión del Contratista · escrituras con la cuenta SQL dedicada supplyflow_mgmtwrite_local (mínimo privilegio, 25 nov 2026):
 * - Tarjeta 1: alta de la validación interna (requisition_reviews, folio SCI-AAAA-NNNN) y edición de las registradas en
 *   SupplyFlow (las importadas del sistema original se conservan como expediente). Cualquier Master Admin puede validar.
 * - Tarjeta 2: plan de abastecimiento versionado (sourcing_plans v+1 con sus lotes, partidas y proveedores); los planes
 *   anteriores y las RFQ ligadas a ellos no se modifican. No emite RFQ, cotizaciones ni OC.
 * Cada escritura: transacción, Idempotency-Key, control de versión, evento de flujo (workflow_events) y bitácora.
 */
final class ContractorMgmtWriteRepository
{
    /** Contrato de permisos (debe coincidir con docker/supply-mgmtwrite/provision.py; tests/mgmtwrite_contract_check.py). */
    public const GRANTS = [
        'SELECT' => ['business_entities', 'idempotency_keys', 'people', 'requisition_items', 'requisition_reviews', 'requisitions', 'sourcing_lots', 'sourcing_plans', 'suppliers', 'users'],
        'INSERT' => ['audit_events', 'business_entities', 'idempotency_keys', 'requisition_reviews', 'sourcing_lot_items', 'sourcing_lot_suppliers', 'sourcing_lots', 'sourcing_plans', 'workflow_events'],
        'UPDATE' => ['idempotency_keys'],
    ];
    public const COLUMN_GRANTS = [
        'requisition_reviews' => ['budget_result', 'buyer_snapshot', 'buyer_user_id', 'contract_result', 'criteria', 'deadline', 'min_quotes', 'notes', 'strategy', 'technical_result'],
        'business_entities' => ['row_version', 'updated_at', 'updated_by'],
    ];
    private const ACCOUNT_REJECTED_ERRNO = [1044, 1045, 1698];
    private mysqli $db;

    public function __construct(?mysqli $test = null)
    {
        if ($test) {
            $this->db = $test;
            return;
        }
        $user = (string) (getenv('MGMTWRITE_DB_USERNAME') ?: '');
        $path = (string) (getenv('MGMTWRITE_DB_PASSWORD_FILE') ?: '');
        if ($user !== 'supplyflow_mgmtwrite_local' || $path !== '/run/secrets/mgmtwrite_db_password' || ! is_readable($path)) {
            throw new MgmtWriteUnavailable('MGMT_WRITE_NOT_PROVISIONED');
        }
        $password = trim((string) file_get_contents($path));
        if (! preg_match('/^[0-9a-f]{64}$/D', $password)) {
            throw new MgmtWriteUnavailable('MGMT_WRITE_NOT_PROVISIONED');
        }
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        try {
            $this->db = new mysqli((string) (getenv('DB_HOST') ?: 'db'), $user, $password, 'supplyflow_dev', (int) (getenv('DB_PORT') ?: 3306));
            SessionContract::initialize($this->db, 'supplyflow_dev');
        } catch (Throwable $error) {
            $errno = $error instanceof \mysqli_sql_exception ? (int) $error->getCode() : 0;
            throw new MgmtWriteUnavailable(in_array($errno, self::ACCOUNT_REJECTED_ERRNO, true) ? 'MGMT_WRITE_ACCOUNT_REJECTED' : 'MGMT_WRITE_UNAVAILABLE', 0, $error);
        } finally {
            unset($password);
        }
    }

    public function __destruct()
    {
        if (isset($this->db)) {
            $this->db->close();
        }
    }

    private function stmt(string $sql, array $args): \mysqli_stmt
    {
        $s = $this->db->prepare($sql);
        if ($args) {
            $s->bind_param(str_repeat('s', count($args)), ...array_map(static fn ($a) => $a === null ? null : (string) $a, $args));
        }
        $s->execute();
        return $s;
    }

    private function rows(string $sql, array $args = []): array
    {
        $s = $this->stmt($sql, $args);
        try {
            $r = $s->get_result();
            if (! $r instanceof mysqli_result) {
                throw new RuntimeException('MGMT_QUERY_FAILED');
            }
            return $r->fetch_all(MYSQLI_ASSOC);
        } finally {
            $s->close();
        }
    }

    private function one(string $sql, array $args = []): ?array
    {
        return $this->rows($sql, $args)[0] ?? null;
    }

    private function exec(string $sql, array $args = []): int
    {
        $s = $this->stmt($sql, $args);
        try {
            return (int) $s->affected_rows;
        } finally {
            $s->close();
        }
    }

    private function insert(string $table, array $values): int
    {
        $this->exec('INSERT INTO `' . $table . '` (`' . implode('`,`', array_keys($values)) . '`) VALUES (' . implode(',', array_fill(0, count($values), '?')) . ')', array_values($values));
        return (int) $this->db->insert_id;
    }

    private static function uuid(): string
    {
        $v = bin2hex(random_bytes(16));
        $v[12] = '4';
        $v[16] = dechex((hexdec($v[16]) & 3) | 8);
        return substr($v, 0, 8) . '-' . substr($v, 8, 4) . '-' . substr($v, 12, 4) . '-' . substr($v, 16, 4) . '-' . substr($v, 20);
    }

    private static function json(mixed $v): string
    {
        return json_encode($v, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /** Read-only diagnostic: privileges of the contract the account in use does NOT have (["INSERT requisition_reviews", "UPDATE(notes) requisition_reviews", ...]). */
    public function missingGrants(): array
    {
        $user = (string) ($this->one('SELECT CURRENT_USER() AS u')['u'] ?? '');
        $at = strrpos($user, '@');
        $grantee = "'" . substr($user, 0, $at === false ? null : $at) . "'@'" . ($at === false ? '%' : substr($user, $at + 1)) . "'";
        $have = [];
        foreach ($this->rows('SELECT TABLE_NAME AS t, PRIVILEGE_TYPE AS p FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE=? AND TABLE_SCHEMA=?', [$grantee, 'supplyflow_dev']) as $r) {
            $have[$r['p'] . ' ' . $r['t']] = true;
        }
        foreach ($this->rows('SELECT TABLE_NAME AS t, COLUMN_NAME AS c, PRIVILEGE_TYPE AS p FROM information_schema.COLUMN_PRIVILEGES WHERE GRANTEE=? AND TABLE_SCHEMA=?', [$grantee, 'supplyflow_dev']) as $r) {
            $have[$r['p'] . '(' . $r['c'] . ') ' . $r['t']] = true;
        }
        $missing = [];
        foreach (self::GRANTS as $privilege => $tables) {
            foreach ($tables as $table) {
                if (! isset($have[$privilege . ' ' . $table])) {
                    $missing[] = $privilege . ' ' . $table;
                }
            }
        }
        foreach (self::COLUMN_GRANTS as $table => $columns) {
            foreach ($columns as $column) {
                if (! isset($have['UPDATE(' . $column . ') ' . $table])) {
                    $missing[] = 'UPDATE(' . $column . ') ' . $table;
                }
            }
        }
        return $missing;
    }

    public static function expectedGrants(): int
    {
        return array_sum(array_map('count', self::GRANTS)) + array_sum(array_map('count', self::COLUMN_GRANTS));
    }

    private function claim(int $org, int $actor, string $endpoint, string $key, string $hash): ?array
    {
        $digest = hash('sha256', $key, true);
        if ($this->exec("INSERT IGNORE INTO idempotency_keys (organization_id,actor_user_id,endpoint_code,key_sha256,request_sha256,state_code,created_at,expires_at) VALUES (?,?,?,?,?,'processing',UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 30 DAY))", [$org, $actor, $endpoint, $digest, $hash]) === 1) {
            return null;
        }
        $row = $this->one('SELECT request_sha256,state_code,response_json FROM idempotency_keys WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=?', [$org, $actor, $endpoint, $digest]);
        if (! $row || ! hash_equals((string) $row['request_sha256'], $hash)) {
            throw new MgmtConflict('IDEMPOTENCY_CONFLICT', 'La clave de solicitud ya se usó para otro contenido.');
        }
        if ($row['state_code'] !== 'done') {
            throw new MgmtConflict('IDEMPOTENCY_PENDING', 'La operación sigue en proceso. Reintenta en unos segundos.');
        }
        $saved = json_decode((string) $row['response_json'], true);
        if (! is_array($saved)) {
            throw new RuntimeException('REPLAY_UNAVAILABLE');
        }
        $saved['replayed'] = true;
        return $saved;
    }

    private function finish(int $org, int $actor, string $endpoint, string $key, int $status, array $response): void
    {
        $this->exec("UPDATE idempotency_keys SET state_code='done',response_status=?,response_json=? WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? AND state_code='processing'",
            [$status, self::json($response), $org, $actor, $endpoint, hash('sha256', $key, true)]);
    }

    private function lock(string $name): void
    {
        if ((int) ($this->one('SELECT GET_LOCK(?,10) AS g', [$name])['g'] ?? 0) !== 1) {
            throw new MgmtConflict('BUSY', 'La operación está ocupada. Reintenta el mismo guardado.');
        }
    }

    private function unlock(string $name): void
    {
        try {
            $this->one('SELECT RELEASE_LOCK(?) AS r', [$name]);
        } catch (Throwable) {
            // Closing the connection also releases it; never hide the primary error.
        }
    }

    private function event(int $org, int $entity, int $actor, string $workflow, string $action, ?string $to, array $payload, string $comment): void
    {
        $json = self::json($payload);
        $this->insert('workflow_events', ['organization_id' => $org, 'entity_id' => $entity, 'public_id' => self::uuid(), 'workflow_code' => $workflow, 'action_code' => $action,
            'to_state' => $to, 'actor_user_id' => $actor, 'comment_text' => $comment, 'payload_schema_version' => 1, 'payload_json' => $json,
            'occurred_at' => gmdate('Y-m-d H:i:s'), 'recorded_at' => gmdate('Y-m-d H:i:s'), 'content_sha256' => hash('sha256', $json, true), 'provenance' => 'system']);
    }

    private function audit(int $org, int $entity, int $actor, string $action, array $detail): void
    {
        $this->insert('audit_events', ['organization_id' => $org, 'public_id' => self::uuid(), 'subject_entity_id' => $entity, 'actor_user_id' => $actor, 'module_code' => 'contractor_management',
            'action_code' => $action, 'result_code' => 'success', 'occurred_at' => gmdate('Y-m-d H:i:s'), 'recorded_at' => gmdate('Y-m-d H:i:s'), 'changes_json' => self::json($detail), 'source_kind' => 'system']);
    }

    private function requisition(int $org, string $public): array
    {
        $r = $this->one("SELECT r.id,r.folio FROM requisitions r JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id AND e.entity_kind='requisition' WHERE r.organization_id=? AND e.public_id=? AND e.archived_at IS NULL", [$org, $public]);
        if (! $r) {
            throw new MgmtConflict('NOT_FOUND', 'Requisición no encontrada.', 404);
        }
        return $r;
    }

    /** Purchasing manager: active personnel of the organization with an active SupplyFlow user with access. */
    private function buyer(int $org, string $personPublic): array
    {
        $b = $this->one("SELECT p.display_name AS name,p.email,p.phone,p.position_title AS position,u.id AS user_id FROM people p JOIN users u ON u.person_id=p.id AND u.organization_id=p.organization_id
            WHERE p.organization_id=? AND p.public_id=? AND p.active=1 AND u.status_code='active' AND u.access_enabled=1", [$org, $personPublic]);
        if (! $b) {
            throw new MgmtConflict('BUYER_UNAVAILABLE', 'El responsable de compras debe ser personal activo con usuario activo en SupplyFlow.', 422, 'buyer_id');
        }
        return $b;
    }

    private static function buyerSnapshot(array $b): string
    {
        return self::json(['buyer' => $b['name'], 'buyerEmail' => $b['email'], 'buyerPhone' => $b['phone'], 'buyerPosition' => $b['position']]);
    }

    private static function reviewView(array $p, string $folio, array $b): array
    {
        return ['folio' => $folio, 'buyer' => $b['name'], 'technical' => $p['technical'], 'contract' => $p['contract'], 'budget' => $p['budget'], 'strategy' => $p['strategy'],
            'min_quotes' => $p['min_quotes'], 'deadline' => $p['deadline'], 'criteria' => $p['criteria'], 'notes' => $p['notes'] === '' ? null : $p['notes']];
    }

    /** Next internal folio SCI-AAAA-NNNN of the business year (max + 1; the unique key protects it). */
    private function nextFolio(int $org, string $today): string
    {
        $prefix = 'SCI-' . substr($today, 0, 4) . '-';
        $max = 0;
        foreach ($this->rows('SELECT folio FROM requisition_reviews WHERE organization_id=? AND folio LIKE ?', [$org, $prefix . '%']) as $r) {
            $tail = substr((string) $r['folio'], strlen($prefix));
            if (ctype_digit($tail)) {
                $max = max($max, (int) $tail);
            }
        }
        return $prefix . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    public function createReview(int $org, int $actor, array $p, string $today, string $key): array
    {
        $endpoint = 'contractor_mgmt.review.create';
        $hash = hash('sha256', self::json($p), true);
        $lock = 'supplyflow.mgmt.review.' . $org;
        $this->lock($lock);
        $this->db->begin_transaction();
        try {
            if ($again = $this->claim($org, $actor, $endpoint, $key, $hash)) {
                $this->db->commit();
                return $again;
            }
            $req = $this->requisition($org, $p['requisition_id']);
            $b = $this->buyer($org, $p['buyer_id']);
            $folio = $this->nextFolio($org, $today);
            $public = self::uuid();
            $now = gmdate('Y-m-d H:i:s');
            $id = $this->insert('business_entities', ['organization_id' => $org, 'public_id' => $public, 'entity_kind' => 'review', 'created_at' => $now, 'updated_at' => $now,
                'created_by' => $actor, 'updated_by' => $actor, 'row_version' => 1]);
            $this->insert('requisition_reviews', ['id' => $id, 'organization_id' => $org, 'requisition_id' => $req['id'], 'folio' => $folio, 'buyer_user_id' => $b['user_id'],
                'buyer_snapshot' => self::buyerSnapshot($b), 'technical_result' => $p['technical'], 'contract_result' => $p['contract'], 'budget_result' => $p['budget'],
                'strategy' => $p['strategy'], 'min_quotes' => $p['min_quotes'], 'deadline' => $p['deadline'], 'criteria' => $p['criteria'], 'notes' => $p['notes'] === '' ? null : $p['notes']]);
            $can = ContractorMgmtInput::canQuote($p['technical'], $p['contract'], $p['budget']);
            $view = self::reviewView($p, $folio, $b);
            $this->event($org, (int) $req['id'], $actor, 'contractor_validation', 'validation.recorded', $can ? 'ready_to_quote' : 'blocked', ['review' => $public] + $view + ['can_quote' => $can],
                "Validación interna {$folio}" . ($can ? ': puede pasar a cotización.' : ': bloqueada para cotizar.'));
            $this->audit($org, $id, $actor, 'review.create', ['requisition' => $req['folio'], 'after' => $view, 'can_quote' => $can]);
            $out = ['id' => $public, 'folio' => $folio, 'requisition_id' => $p['requisition_id'], 'requisition' => $req['folio'], 'version' => 1, 'can_quote' => $can, 'replayed' => false];
            $this->finish($org, $actor, $endpoint, $key, 201, $out);
            $this->db->commit();
            return $out;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        } finally {
            $this->unlock($lock);
        }
    }

    /** Current deadline of a review (for the "unchanged deadline" rule) or null when it does not exist. */
    public function reviewDeadline(int $org, string $public): ?string
    {
        $r = $this->one("SELECT rv.deadline FROM requisition_reviews rv JOIN business_entities e ON e.id=rv.id AND e.organization_id=rv.organization_id WHERE rv.organization_id=? AND e.public_id=? AND e.entity_kind='review'", [$org, $public]);
        return $r['deadline'] ?? null;
    }

    public function updateReview(int $org, int $actor, string $public, int $version, array $p, string $key): array
    {
        $endpoint = 'contractor_mgmt.review.update:' . $public;
        $hash = hash('sha256', self::json($p + ['_version' => $version]), true);
        $this->db->begin_transaction();
        try {
            if ($again = $this->claim($org, $actor, $endpoint, $key, $hash)) {
                $this->db->commit();
                return $again;
            }
            $r = $this->one("SELECT rv.*,e.row_version,e.imported_at,e.legacy_id,r.folio AS requisition FROM requisition_reviews rv
                JOIN business_entities e ON e.id=rv.id AND e.organization_id=rv.organization_id AND e.entity_kind='review'
                JOIN requisitions r ON r.id=rv.requisition_id AND r.organization_id=rv.organization_id
                WHERE rv.organization_id=? AND e.public_id=? AND e.archived_at IS NULL", [$org, $public]);
            if (! $r) {
                throw new MgmtConflict('NOT_FOUND', 'Validación no encontrada.', 404);
            }
            if ($r['imported_at'] !== null || $r['legacy_id'] !== null) {
                throw new MgmtConflict('IMPORTED_READ_ONLY', 'Es una validación importada del sistema original: se conserva como expediente. Registra una nueva validación para la requisición.');
            }
            if ((int) $r['row_version'] !== $version) {
                throw new MgmtStale('La validación cambió desde que se abrió. Vuelve a abrirla desde la matriz.');
            }
            $b = $this->buyer($org, $p['buyer_id']);
            $before = ['folio' => $r['folio'], 'buyer' => json_decode((string) $r['buyer_snapshot'], true)['buyer'] ?? null, 'technical' => $r['technical_result'], 'contract' => $r['contract_result'],
                'budget' => $r['budget_result'], 'strategy' => $r['strategy'], 'min_quotes' => (int) $r['min_quotes'], 'deadline' => $r['deadline'], 'criteria' => $r['criteria'], 'notes' => $r['notes']];
            $after = self::reviewView($p, (string) $r['folio'], $b);
            $changed = array_keys(array_filter($after, static fn ($v, $k) => (string) ($before[$k] ?? '') !== (string) ($v ?? ''), ARRAY_FILTER_USE_BOTH));
            $newVersion = $version;
            if ($changed) {
                $this->exec('UPDATE requisition_reviews SET buyer_user_id=?,buyer_snapshot=?,technical_result=?,contract_result=?,budget_result=?,strategy=?,min_quotes=?,deadline=?,criteria=?,notes=? WHERE organization_id=? AND id=?',
                    [$b['user_id'], self::buyerSnapshot($b), $p['technical'], $p['contract'], $p['budget'], $p['strategy'], $p['min_quotes'], $p['deadline'], $p['criteria'], $p['notes'] === '' ? null : $p['notes'], $org, $r['id']]);
                if ($this->exec('UPDATE business_entities SET row_version=row_version+1,updated_at=UTC_TIMESTAMP(6),updated_by=? WHERE organization_id=? AND id=? AND row_version=?', [$actor, $org, $r['id'], $version]) !== 1) {
                    throw new MgmtStale('La validación cambió desde que se abrió. Vuelve a abrirla desde la matriz.');
                }
                $newVersion = $version + 1;
                $can = ContractorMgmtInput::canQuote($p['technical'], $p['contract'], $p['budget']);
                $this->event($org, (int) $r['requisition_id'], $actor, 'contractor_validation', 'validation.updated', $can ? 'ready_to_quote' : 'blocked', ['review' => $public, 'changed' => $changed] + $after + ['can_quote' => $can],
                    "Validación interna {$r['folio']} actualizada (" . implode(', ', $changed) . ').');
                $this->audit($org, (int) $r['id'], $actor, 'review.update', ['requisition' => $r['requisition'], 'before' => $before, 'after' => $after, 'changed' => $changed]);
            }
            $out = ['id' => $public, 'folio' => $r['folio'], 'version' => $newVersion, 'changed' => $changed, 'can_quote' => ContractorMgmtInput::canQuote($p['technical'], $p['contract'], $p['budget']), 'replayed' => false];
            $this->finish($org, $actor, $endpoint, $key, 200, $out);
            $this->db->commit();
            return $out;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    /**
     * Saves the sourcing strategy of a requisition as plan version N+1 ($expected = current version, 0 = none). Requires the
     * latest validation to allow quoting. Lines must be exactly the active lines of the requisition; "Precio histórico auto"
     * lines go without lot (recorded in the plan's workflow event). Older plans and their RFQs are not modified.
     */
    public function saveStrategy(int $org, int $actor, string $requisitionPublic, int $expected, array $p, string $key): array
    {
        $endpoint = 'contractor_mgmt.strategy.save:' . $requisitionPublic;
        $hash = hash('sha256', self::json($p + ['_version' => $expected]), true);
        $lock = 'supplyflow.mgmt.strategy.' . $org;
        $this->lock($lock);
        $this->db->begin_transaction();
        try {
            if ($again = $this->claim($org, $actor, $endpoint, $key, $hash)) {
                $this->db->commit();
                return $again;
            }
            $req = $this->requisition($org, $requisitionPublic);
            $rid = (int) $req['id'];
            $rv = $this->one('SELECT rv.folio,rv.technical_result,rv.contract_result,rv.budget_result FROM requisition_reviews rv WHERE rv.organization_id=? AND rv.requisition_id=? ORDER BY rv.id DESC LIMIT 1', [$org, $rid]);
            if (! $rv) {
                throw new MgmtConflict('REVIEW_REQUIRED', 'La requisición no tiene validación interna: regístrala en «Registro de validación».');
            }
            if (! ContractorMgmtInput::canQuote((string) $rv['technical_result'], (string) $rv['contract_result'], (string) $rv['budget_result'])) {
                throw new MgmtConflict('REVIEW_BLOCKS_QUOTING', "La validación vigente {$rv['folio']} no permite pasar a cotización: actualízala antes de guardar la estrategia.");
            }
            $current = (int) ($this->one('SELECT MAX(version_number) AS v FROM sourcing_plans WHERE organization_id=? AND requisition_id=?', [$org, $rid])['v'] ?? 0);
            if ($current !== $expected) {
                throw new MgmtStale('La estrategia cambió desde que se abrió (otra sesión guardó una versión nueva). Vuelve a abrir la requisición.');
            }
            $lines = [];
            foreach ($this->rows('SELECT id,public_id,line_number,COALESCE(category_label_snapshot,\'\') AS category FROM requisition_items WHERE organization_id=? AND requisition_id=? AND cancelled_at IS NULL', [$org, $rid]) as $l) {
                $lines[$l['public_id']] = $l;
            }
            $sent = array_column($p['items'], null, 'id');
            if (count($sent) !== count($lines) || array_diff_key($sent, $lines) !== []) {
                throw new MgmtConflict('LINES_CHANGED', 'Las partidas de la requisición cambiaron desde que se abrió. Vuelve a abrir la requisición.');
            }
            $supIds = [];
            foreach ($p['lots'] as $l) {
                foreach ($l['suppliers'] as $s) {
                    $supIds[$s['id']] = true;
                }
            }
            $suppliers = [];
            if ($supIds) {
                $in = implode(',', array_fill(0, count($supIds), '?'));
                foreach ($this->rows("SELECT s.id,e.public_id,s.legal_name,s.status_code FROM suppliers s JOIN business_entities e ON e.id=s.id AND e.organization_id=s.organization_id WHERE s.organization_id=? AND e.archived_at IS NULL AND e.public_id IN ({$in})", [$org, ...array_keys($supIds)]) as $s) {
                    $suppliers[$s['public_id']] = $s;
                }
            }
            foreach ($p['lots'] as $l) {
                foreach ($l['suppliers'] as $s) {
                    $x = $suppliers[$s['id']] ?? null;
                    if (! $x) {
                        throw new MgmtConflict('SUPPLIER_UNAVAILABLE', "Lote «{$l['name']}»: un proveedor ya no existe en el catálogo.", 422, 'lots');
                    }
                    if ($s['selected'] && in_array($x['status_code'], ['suspended', 'inactive', 'blocked'], true)) {
                        throw new MgmtConflict('SUPPLIER_NOT_ASSIGNABLE', "Lote «{$l['name']}»: {$x['legal_name']} está {$x['status_code']} y no se puede seleccionar.", 422, 'lots');
                    }
                }
            }
            $version = $current + 1;
            $now = gmdate('Y-m-d H:i:s');
            $planId = $this->insert('sourcing_plans', ['organization_id' => $org, 'requisition_id' => $rid, 'version_number' => $version, 'min_quotes' => $p['min_quotes'], 'updated_at' => $now]);
            $summary = [];
            foreach ($p['lots'] as $l) {
                $lotId = $this->insert('sourcing_lots', ['organization_id' => $org, 'requisition_id' => $rid, 'sourcing_plan_id' => $planId, 'name' => $l['name'], 'min_quotes' => $l['min_quotes']]);
                foreach ($l['items'] as $itemPublic) {
                    $line = $lines[$itemPublic];
                    $this->insert('sourcing_lot_items', ['organization_id' => $org, 'requisition_id' => $rid, 'sourcing_lot_id' => $lotId, 'requisition_item_id' => $line['id'],
                        'strategy' => $sent[$itemPublic]['strategy'], 'category_snapshot' => $line['category'] === '' ? null : $line['category']]);
                }
                foreach ($l['suppliers'] as $s) {
                    $this->insert('sourcing_lot_suppliers', ['organization_id' => $org, 'sourcing_lot_id' => $lotId, 'supplier_id' => $suppliers[$s['id']]['id'], 'selected' => (int) $s['selected'], 'suggested' => (int) $s['suggested']]);
                }
                $summary[] = ['name' => $l['name'], 'min_quotes' => $l['min_quotes'], 'lines' => array_map(static fn ($i) => (int) $lines[$i]['line_number'], $l['items']),
                    'selected' => array_values(array_map(static fn ($s) => $suppliers[$s['id']]['legal_name'], array_filter($l['suppliers'], static fn ($s) => $s['selected'])))];
            }
            $noRfq = array_values(array_map(static fn ($i) => $i['id'], array_filter($p['items'], static fn ($i) => $i['strategy'] === ContractorMgmtInput::NO_RFQ)));
            $selected = [];
            foreach ($p['lots'] as $l) {
                foreach ($l['suppliers'] as $s) {
                    if ($s['selected']) {
                        $selected[$s['id']] = true;
                    }
                }
            }
            $payload = ['plan_version' => $version, 'review' => $rv['folio'], 'min_quotes' => $p['min_quotes'], 'no_rfq_items' => $noRfq, 'lots' => $summary];
            $this->event($org, $rid, $actor, 'sourcing_strategy', 'strategy.saved', 'planned', $payload,
                "Estrategia v{$version} de {$req['folio']}: " . count($p['lots']) . ' lote(s), ' . count($selected) . ' proveedor(es) seleccionado(s).');
            $this->audit($org, $rid, $actor, 'strategy.save', ['requisition' => $req['folio'], 'previous_version' => $current ?: null] + $payload);
            $out = ['requisition_id' => $requisitionPublic, 'requisition' => $req['folio'], 'plan_version' => $version, 'lots' => count($p['lots']), 'suppliers' => count($selected),
                'rfq_lines' => count($p['items']) - count($noRfq), 'no_rfq_lines' => count($noRfq), 'replayed' => false];
            $this->finish($org, $actor, $endpoint, $key, 200, $out);
            $this->db->commit();
            return $out;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        } finally {
            $this->unlock($lock);
        }
    }
}

final class MgmtWriteUnavailable extends RuntimeException
{
}

final class MgmtConflict extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message, public readonly int $status = 409, public readonly ?string $field = null)
    {
        parent::__construct($message);
    }
}

final class MgmtStale extends RuntimeException
{
}
