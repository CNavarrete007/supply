<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Database\SessionContract;
use mysqli;
use RuntimeException;
use Throwable;

final class UserAccessConflict extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message, public readonly int $status = 409)
    {
        parent::__construct($message);
    }
}

/**
 * Usuarios y roles · gestión de acceso con la cuenta dedicada supplyflow_useradmin_local (25 nov 2026).
 * Solo: credencial temporal (Argon2id, estado reset_required, vence en 72 h), rol Master Admin (asignar / retirar), acceso
 * habilitado y revocación de las sesiones del usuario afectado; más idempotencia y bitácora (módulo users). La cuenta tiene
 * UPDATE por columna en users (password_hash, credential_state, access_enabled, updated_at, row_version): no puede cambiar
 * nombres, correos ni estatus. Nunca registra ni devuelve contraseñas fuera de la respuesta inmediata que genera la temporal.
 */
final class UserAccessRepository
{
    public const GRANTS = [
        'SELECT' => ['users', 'people', 'roles', 'user_roles', 'auth_sessions', 'idempotency_keys'],
        'INSERT' => ['user_roles', 'audit_events', 'idempotency_keys'],
        'UPDATE' => ['idempotency_keys'],
        'DELETE' => ['user_roles'],
    ];
    public const COLUMN_GRANTS = [
        'users' => ['password_hash', 'credential_state', 'access_enabled', 'updated_at', 'row_version'],
        'auth_sessions' => ['revoked_at', 'revocation_reason'],
    ];
    public const TEMP_HOURS = 72;
    private mysqli $db;

    public function __construct()
    {
        $user = (string) (getenv('USERADMIN_DB_USERNAME') ?: '');
        $file = (string) (getenv('USERADMIN_DB_PASSWORD_FILE') ?: '');
        if ($user !== 'supplyflow_useradmin_local' || $file !== '/run/secrets/useradmin_db_password' || ! is_readable($file)) {
            throw new RuntimeException('USERADMIN_NOT_PROVISIONED');
        }
        $secret = trim((string) file_get_contents($file));
        if (! preg_match('/^[0-9a-f]{64}$/D', $secret)) {
            throw new RuntimeException('USERADMIN_NOT_PROVISIONED');
        }
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        try {
            $this->db = new mysqli('db', $user, $secret, 'supplyflow_dev', 3306);
            SessionContract::initialize($this->db, 'supplyflow_dev');
        } finally {
            unset($secret);
        }
    }

    public function __destruct()
    {
        if (isset($this->db)) {
            $this->db->close();
        }
    }

    private function rows(string $sql, array $args = []): array
    {
        $s = $this->db->prepare($sql);
        try {
            if ($args) {
                $s->bind_param(str_repeat('s', count($args)), ...$args);
            }
            $s->execute();
            $r = $s->get_result();
            return $r === false ? [] : $r->fetch_all(MYSQLI_ASSOC);
        } finally {
            $s->close();
        }
    }

    private function one(string $sql, array $args = []): ?array
    {
        return $this->rows($sql, $args)[0] ?? null;
    }

    private function run(string $sql, array $args = []): int
    {
        $s = $this->db->prepare($sql);
        try {
            if ($args) {
                $s->bind_param(str_repeat('s', count($args)), ...$args);
            }
            $s->execute();
            return $s->affected_rows;
        } finally {
            $s->close();
        }
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

    /** Grants of the contract this account does not have (e.g. "UPDATE users.password_hash"). */
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
            $have[$r['p'] . ' ' . $r['t'] . '.' . $r['c']] = true;
        }
        $missing = [];
        foreach (self::GRANTS as $p => $tables) {
            foreach ($tables as $t) {
                if (! isset($have[$p . ' ' . $t])) {
                    $missing[] = $p . ' ' . $t;
                }
            }
        }
        foreach (self::COLUMN_GRANTS as $t => $cols) {
            foreach ($cols as $c) {
                if (! isset($have['UPDATE ' . $t . '.' . $c])) {
                    $missing[] = 'UPDATE ' . $t . '.' . $c;
                }
            }
        }
        return $missing;
    }

    public static function expectedGrants(): int
    {
        return array_sum(array_map('count', self::GRANTS)) + array_sum(array_map('count', self::COLUMN_GRANTS));
    }

    private function audit(int $org, int $actor, int $subject, string $action, array $changes): void
    {
        $this->run("INSERT INTO audit_events (organization_id,public_id,subject_user_id,actor_user_id,module_code,action_code,result_code,occurred_at,recorded_at,changes_json,source_kind) VALUES (?,?,?,?,'users',?,'success',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),?,'system')",
            [$org, self::uuid(), $subject, $actor, $action, self::json($changes)]);
    }

    private function revokeSessions(int $org, int $user, string $reason): int
    {
        return $this->run('UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6),revocation_reason=? WHERE organization_id=? AND user_id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(6)', [$reason, $org, $user]);
    }

    private function masterRole(int $org): int
    {
        $r = $this->one("SELECT id FROM roles WHERE organization_id=? AND code='master_admin'", [$org]);
        if (! $r) {
            throw new UserAccessConflict('ROLE_MISSING', 'El rol Master Admin no existe en esta base.');
        }
        return (int) $r['id'];
    }

    /**
     * grant_master_admin | reset_password | revoke_master_admin on ANOTHER active user of the organization.
     * @return array<string,mixed> includes temporary_password ONLY on the first (non-replayed) response that generated one.
     */
    public function apply(int $org, int $actor, string $publicId, int $version, string $action, string $reason, string $key): array
    {
        $endpoint = 'users.access:' . $publicId;
        $requestHash = hash('sha256', self::json(['action' => $action, 'reason' => $reason, 'version' => $version]), true);
        $keyHash = hash('sha256', $key, true);
        $this->db->begin_transaction();
        try {
            $old = $this->one('SELECT request_sha256,state_code,response_json FROM idempotency_keys WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? FOR UPDATE', [$org, $actor, $endpoint, $keyHash]);
            if ($old) {
                if (! hash_equals((string) $old['request_sha256'], $requestHash)) {
                    throw new UserAccessConflict('IDEMPOTENCY_CONFLICT', 'La clave ya se usó con otro contenido.');
                }
                $this->db->commit();
                $replay = json_decode((string) $old['response_json'], true, 512, JSON_THROW_ON_ERROR);
                $replay['replayed'] = true;
                return $replay;
            }
            $this->run("INSERT INTO idempotency_keys (organization_id,actor_user_id,endpoint_code,key_sha256,request_sha256,state_code,created_at,expires_at) VALUES (?,?,?,?,?,'processing',UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 30 DAY))",
                [$org, $actor, $endpoint, $keyHash, $requestHash]);
            $u = $this->one('SELECT u.id,u.public_id,u.login_email,u.password_hash IS NOT NULL AS has_hash,u.credential_state,u.access_enabled,u.status_code,u.row_version,p.active AS person_active,p.display_name
                FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.organization_id=? AND u.public_id=? FOR UPDATE', [$org, $publicId]);
            if (! $u) {
                throw new UserAccessConflict('NOT_FOUND', 'Usuario no encontrado.', 404);
            }
            $target = (int) $u['id'];
            if ($target === $actor) {
                throw new UserAccessConflict('SELF_NOT_ALLOWED', 'No puedes cambiar tu propio acceso desde aquí: otro Master Admin debe hacerlo. Para cambiar tu contraseña usa «Cambiar contraseña».');
            }
            if ((int) $u['row_version'] !== $version) {
                throw new UserAccessConflict('STALE_VERSION', 'El usuario cambió desde que se abrió. Recarga la ficha.', 412);
            }
            if ($u['status_code'] !== 'active' || (int) $u['person_active'] !== 1) {
                throw new UserAccessConflict('USER_INACTIVE', 'El usuario no está activo; no se le puede dar acceso.');
            }
            if ($u['credential_state'] === 'external') {
                throw new UserAccessConflict('EXTERNAL_IDENTITY', 'El usuario se autentica con un proveedor externo; su contraseña no se administra aquí.');
            }
            $role = $this->masterRole($org);
            $wasAdmin = (bool) $this->one('SELECT 1 AS x FROM user_roles WHERE organization_id=? AND user_id=? AND role_id=?', [$org, $target, $role]);
            $before = ['master_admin' => $wasAdmin, 'credential_state' => $u['credential_state'], 'access_enabled' => (bool) $u['access_enabled']];
            $temp = null;
            $set = [];
            if ($action === 'grant_master_admin') {
                if ($wasAdmin && $u['credential_state'] === 'local_validated' && (int) $u['access_enabled'] === 1) {
                    throw new UserAccessConflict('ALREADY_MASTER_ADMIN', 'El usuario ya es Master Admin con acceso activo.');
                }
                if (! $wasAdmin) {
                    $this->run('INSERT INTO user_roles (organization_id,user_id,role_id) VALUES (?,?,?)', [$org, $target, $role]);
                }
                $set['access_enabled'] = 1;
                if ($u['credential_state'] !== 'local_validated' || ! (int) $u['has_hash']) {
                    $temp = UserAccessInput::temporaryPassword();
                }
            } elseif ($action === 'reset_password') {
                if (! $wasAdmin) {
                    throw new UserAccessConflict('NOT_MASTER_ADMIN', 'Solo se restablece la contraseña de usuarios Master Admin.');
                }
                $set['access_enabled'] = 1;
                $temp = UserAccessInput::temporaryPassword();
            } else { // revoke_master_admin
                if (! $wasAdmin) {
                    throw new UserAccessConflict('NOT_MASTER_ADMIN', 'El usuario no es Master Admin.');
                }
                $others = (int) ($this->one("SELECT COUNT(*) AS n FROM user_roles ur JOIN users x ON x.id=ur.user_id AND x.organization_id=ur.organization_id
                    JOIN people p ON p.id=x.person_id AND p.organization_id=x.organization_id
                    WHERE ur.organization_id=? AND ur.role_id=? AND ur.user_id<>? AND x.status_code='active' AND x.access_enabled=1 AND x.credential_state='local_validated' AND p.active=1", [$org, $role, $target])['n'] ?? 0);
                if ($others < 1) {
                    throw new UserAccessConflict('LAST_ADMIN', 'No se puede retirar: quedaría sin ningún Master Admin con acceso.');
                }
                $this->run('DELETE FROM user_roles WHERE organization_id=? AND user_id=? AND role_id=?', [$org, $target, $role]);
                $remaining = (int) ($this->one('SELECT COUNT(*) AS n FROM user_roles WHERE organization_id=? AND user_id=?', [$org, $target])['n'] ?? 0);
                if ($remaining === 0) {
                    $set['access_enabled'] = 0; // sin ningún rol: no conserva una credencial que no puede usar
                }
            }
            if ($temp !== null) {
                $set['password_hash'] = UserAccessInput::hash($temp);
                $set['credential_state'] = 'reset_required';
            }
            $cols = '';
            $args = [];
            foreach ($set as $k => $v) {
                $cols .= "`$k`=?,";
                $args[] = $v;
            }
            if ($this->run('UPDATE users SET ' . $cols . 'updated_at=UTC_TIMESTAMP(6),row_version=row_version+1 WHERE id=? AND organization_id=? AND row_version=?', [...$args, $target, $org, $version]) !== 1) {
                throw new UserAccessConflict('STALE_VERSION', 'El usuario cambió desde que se abrió. Recarga la ficha.', 412);
            }
            $revoked = $this->revokeSessions($org, $target, 'access_changed');
            $now = $this->one('SELECT u.row_version,u.credential_state,u.access_enabled,DATE_FORMAT(DATE_ADD(u.updated_at,INTERVAL ' . self::TEMP_HOURS . ' HOUR),\'%Y-%m-%dT%H:%i:%sZ\') AS expires FROM users u WHERE u.id=? AND u.organization_id=?', [$target, $org]);
            $after = ['master_admin' => $action !== 'revoke_master_admin', 'credential_state' => $now['credential_state'], 'access_enabled' => (bool) $now['access_enabled']];
            $this->audit($org, $actor, $target, 'users.access.' . $action, ['user' => $u['public_id'], 'email' => $u['login_email'], 'before' => $before, 'after' => $after,
                'temporary_password_issued' => $temp !== null, 'temporary_password_expires_at' => $temp !== null ? $now['expires'] : null, 'sessions_revoked' => $revoked, 'reason' => $reason]);
            $response = ['id' => $u['public_id'], 'version' => (int) $now['row_version'], 'action' => $action, 'name' => $u['display_name'], 'email' => $u['login_email'],
                'master_admin' => $after['master_admin'], 'credential_state' => $after['credential_state'], 'access_enabled' => $after['access_enabled'], 'sessions_revoked' => $revoked,
                'temporary_password_issued' => $temp !== null, 'temporary_password_expires_at' => $temp !== null ? $now['expires'] : null, 'replayed' => false];
            // The stored replay NEVER contains the password: it is shown once.
            $this->run("UPDATE idempotency_keys SET state_code='done',response_status=200,response_json=? WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=?",
                [self::json($response + ['temporary_password' => null]), $org, $actor, $endpoint, $keyHash]);
            $this->db->commit();
            return $response + ['temporary_password' => $temp];
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    /** First-login (or voluntary) password change by the user, after verifying the current password with the auth account. */
    public function changePassword(int $org, int $user, string $newPassword, bool $wasTemporary): void
    {
        $this->db->begin_transaction();
        try {
            if ($this->run("UPDATE users SET password_hash=?,credential_state='local_validated',updated_at=UTC_TIMESTAMP(6),row_version=row_version+1 WHERE id=? AND organization_id=? AND status_code='active' AND access_enabled=1",
                [UserAccessInput::hash($newPassword), $user, $org]) !== 1) {
                throw new UserAccessConflict('USER_INACTIVE', 'La cuenta no está activa.');
            }
            $revoked = $this->revokeSessions($org, $user, 'password_changed');
            $this->audit($org, $user, $user, 'auth.password.change', ['temporary_replaced' => $wasTemporary, 'sessions_revoked' => $revoked]);
            $this->db->commit();
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }
}
