<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Database\SessionContract;
use mysqli;
use mysqli_result;
use RuntimeException;
use Throwable;

/** Isolated, least-privilege auth connection. Never uses the read-only API login. */
final class SupplyAuthRepository
{
    private mysqli $db;
    private const COOKIE = 'sf_session';

    public function __construct()
    {
        $user = (string) (getenv('AUTH_DB_USERNAME') ?: '');
        $secretFile = (string) (getenv('AUTH_DB_PASSWORD_FILE') ?: '');
        if ($user !== 'supplyflow_auth_local' || $secretFile !== '/run/secrets/auth_db_password' || ! is_readable($secretFile)) {
            throw new RuntimeException('AUTH_UNAVAILABLE');
        }
        $secret = file_get_contents($secretFile);
        if (! is_string($secret) || ! preg_match('/^[0-9a-f]{64}\s*$/D', $secret)) {
            throw new RuntimeException('AUTH_UNAVAILABLE');
        }
        $secret = rtrim($secret, "\r\n");
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        try {
            $this->db = new mysqli('db', $user, $secret, 'supplyflow_dev', 3306);
            SessionContract::initialize($this->db, 'supplyflow_dev');
        } catch (Throwable) {
            throw new RuntimeException('AUTH_UNAVAILABLE');
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

    /** @return array<string, mixed>|null */
    private function one(string $sql, string $types = '', array $values = []): ?array
    {
        $stmt = $this->db->prepare($sql);
        try {
            if ($types !== '') {
                $stmt->bind_param($types, ...$values);
            }
            $stmt->execute();
            $result = $stmt->get_result();
            if (! $result instanceof mysqli_result) {
                throw new RuntimeException('AUTH_QUERY_FAILED');
            }
            return $result->fetch_assoc() ?: null;
        } finally {
            $stmt->close();
        }
    }

    /** @return list<array<string, mixed>> */
    private function many(string $sql, string $types = '', array $values = []): array
    {
        $stmt = $this->db->prepare($sql);
        try {
            if ($types !== '') {
                $stmt->bind_param($types, ...$values);
            }
            $stmt->execute();
            $result = $stmt->get_result();
            if (! $result instanceof mysqli_result) {
                throw new RuntimeException('AUTH_QUERY_FAILED');
            }
            return $result->fetch_all(MYSQLI_ASSOC);
        } finally {
            $stmt->close();
        }
    }

    private function execute(string $sql, string $types, array $values): void
    {
        $stmt = $this->db->prepare($sql);
        try {
            $stmt->bind_param($types, ...$values);
            $stmt->execute();
        } finally {
            $stmt->close();
        }
    }

    /** @return array<string,mixed>|null */
    public function authenticate(string $email, string $password): ?array
    {
        $matches = $this->one('SELECT COUNT(*) AS total FROM users WHERE normalized_login_email=?', 's', [$email]);
        $account = (int) ($matches['total'] ?? 0) === 1 ? $this->one('SELECT u.id,u.organization_id,u.public_id,u.login_email,u.password_hash,u.credential_state,u.access_enabled,u.status_code,p.active AS person_active,p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.normalized_login_email=? LIMIT 1', 's', [$email]) : null;
        // This constant hash is verified for nonexistent/disabled accounts to reduce timing discrepancy.
        $dummy = '$argon2id$v=19$m=65536,t=3,p=1$V0pJUnUzVC9YU2FkV25ycw$p4gVL0K5Yq+9zI/BdXQuO+CtJhyAS2SmF9lhS/Xgsgk';
        $hash = is_string($account['password_hash'] ?? null) && str_starts_with($account['password_hash'], '$argon2id$')
            ? $account['password_hash'] : $dummy;
        $valid = password_verify($password, $hash);
        if (! $valid || ! $account || ($account['credential_state'] ?? '') !== 'local_validated'
            || (int) $account['access_enabled'] !== 1 || ($account['status_code'] ?? '') !== 'active'
            || (int) $account['person_active'] !== 1) {
            return null;
        }
        return $account;
    }

    /** @return array<string,mixed> */
    public function issueSession(array $account): array
    {
        $raw = bin2hex(random_bytes(32));
        $digest = hash('sha256', $raw, true);
        $sessionId = $this->uuid();
        $eventId = $this->uuid();
        $orgId = (int) $account['organization_id'];
        $userId = (int) $account['id'];
        $actions = json_encode(['auth.login', 'auth.logout', 'users.read', 'roles.read'], JSON_THROW_ON_ERROR);
        $this->db->begin_transaction();
        try {
            $this->execute('INSERT INTO auth_sessions (organization_id,public_id,principal_kind,user_id,token_sha256,authentication_method,allowed_actions_json,created_at,expires_at) VALUES (?, ?,\'internal_user\', ?, ?, \'password_argon2id\', ?, UTC_TIMESTAMP(6), DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 8 HOUR))', 'isiss', [$orgId, $sessionId, $userId, $digest, $actions]);
            $this->execute('INSERT INTO audit_events (organization_id,public_id,subject_user_id,actor_user_id,module_code,action_code,result_code,occurred_at,recorded_at,source_kind) VALUES (?,?,?, ?,\'auth\',\'auth.login\',\'success\',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),\'system\')', 'isii', [$orgId, $eventId, $userId, $userId]);
            $this->db->commit();
            return ['token' => $raw, 'user' => $this->present($account, $this->roles($orgId, $userId))];
        } catch (Throwable $e) {
            $this->db->rollback();
            throw new RuntimeException('AUTH_UNAVAILABLE', 0, $e);
        }
    }

    /** @return array<string,mixed>|null */
    public function currentUser(?string $cookie): ?array
    {
        if (! is_string($cookie) || ! preg_match('/^[a-f0-9]{64}$/D', $cookie)) {
            return null;
        }
        $token = hash('sha256', $cookie, true);
        $row = $this->one('SELECT u.id,u.organization_id,u.public_id,u.login_email,p.display_name,u.credential_state,u.access_enabled,u.status_code,p.active AS person_active,s.id AS session_id FROM auth_sessions s JOIN users u ON u.id=s.user_id AND u.organization_id=s.organization_id JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE s.token_sha256=? AND s.principal_kind=\'internal_user\' AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP(6) LIMIT 1', 's', [$token]);
        if (! $row || $row['credential_state'] !== 'local_validated' || (int) $row['access_enabled'] !== 1 || $row['status_code'] !== 'active' || (int) $row['person_active'] !== 1) {
            return null;
        }
        $roles = $this->roles((int) $row['organization_id'], (int) $row['id']);
        return ['id' => (int) $row['id'], 'organization_id' => (int) $row['organization_id'], 'session_id' => (int) $row['session_id'], 'public_id' => (string) $row['public_id'], 'email' => (string) $row['login_email'], 'name' => (string) $row['display_name'], 'roles' => $roles];
    }

    /** @return list<array{code:string,name:string}> */
    private function roles(int $orgId, int $userId): array
    {
        $stmt = $this->db->prepare('SELECT r.code,r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.organization_id=ur.organization_id WHERE ur.organization_id=? AND ur.user_id=? ORDER BY r.code');
        try {
            $stmt->bind_param('ii', $orgId, $userId);
            $stmt->execute();
            return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        } finally {
            $stmt->close();
        }
    }

    private function present(array $row, array $roles): array
    {
        return ['public_id' => (string) $row['public_id'], 'email' => (string) $row['login_email'], 'name' => (string) $row['display_name'], 'roles' => $roles];
    }

    public function canReadUsers(array $user): bool
    {
        foreach ($user['roles'] as $role) {
            if ($role['code'] === 'master_admin') {
                return true;
            }
        }
        // Future role permissions must be evaluated with user deny overrides.
        return false;
    }

    public function logout(int $sessionId, int $orgId, int $userId): void
    {
        $this->db->begin_transaction();
        try {
            $this->execute('UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6),revocation_reason=\'logout\' WHERE id=? AND organization_id=? AND user_id=? AND revoked_at IS NULL', 'iii', [$sessionId, $orgId, $userId]);
            $this->execute('INSERT INTO audit_events (organization_id,public_id,subject_user_id,actor_user_id,module_code,action_code,result_code,occurred_at,recorded_at,source_kind) VALUES (?,?,?, ?,\'auth\',\'auth.logout\',\'success\',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),\'system\')', 'isii', [$orgId, $this->uuid(), $userId, $userId]);
            $this->db->commit();
        } catch (Throwable $e) {
            $this->db->rollback();
            throw new RuntimeException('AUTH_UNAVAILABLE', 0, $e);
        }
    }

    /** @return array{total:int,items:list<array<string,mixed>>} */
    public function users(int $orgId, int $limit, int $offset): array
    {
        $count = $this->one('SELECT COUNT(*) AS count FROM users WHERE organization_id=?', 'i', [$orgId]);
        $stmt = $this->db->prepare('SELECT u.public_id,u.login_email,u.status_code,u.access_enabled,u.credential_state,COALESCE(u.last_login_at,(SELECT MAX(a.created_at) FROM auth_sessions a WHERE a.user_id=u.id AND a.organization_id=u.organization_id)) AS last_login_at,p.display_name,p.position_title,p.phone, GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR \' | \') AS roles,GROUP_CONCAT(r.code ORDER BY r.name SEPARATOR \' | \') AS role_codes FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id LEFT JOIN user_roles ur ON ur.user_id=u.id AND ur.organization_id=u.organization_id LEFT JOIN roles r ON r.id=ur.role_id AND r.organization_id=ur.organization_id WHERE u.organization_id=? GROUP BY u.id ORDER BY p.display_name,u.id LIMIT ? OFFSET ?');
        try {
            $stmt->bind_param('iii', $orgId, $limit, $offset);
            $stmt->execute();
            $records = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        } finally {
            $stmt->close();
        }
        // Per-user permission overrides (allow/deny). Codes only; no secrets are stored in these tables.
        $overrides = [];
        foreach ($this->many('SELECT u.public_id,p.code,up.effect FROM user_permissions up JOIN users u ON u.id=up.user_id AND u.organization_id=up.organization_id JOIN permissions p ON p.id=up.permission_id WHERE up.organization_id=? ORDER BY p.code', 'i', [$orgId]) as $o) {
            $overrides[(string) $o['public_id']][] = ['code' => (string) $o['code'], 'effect' => (string) $o['effect']];
        }
        return ['total' => (int) ($count['count'] ?? 0), 'items' => array_map(static fn ($r) => [
            'id' => $r['public_id'], 'name' => $r['display_name'], 'email' => $r['login_email'], 'position' => $r['position_title'], 'phone' => $r['phone'], 'status' => $r['status_code'], 'access_enabled' => (bool) $r['access_enabled'], 'credential_state' => $r['credential_state'], 'roles' => $r['roles'] ? explode(' | ', $r['roles']) : [], 'last_login_at' => $r['last_login_at'],
            'role_codes' => $r['role_codes'] ? explode(' | ', $r['role_codes']) : [], 'permission_overrides' => $overrides[(string) $r['public_id']] ?? [],
        ], $records)];
    }

    /** @return list<array<string,mixed>> */
    public function allRoles(int $orgId): array
    {
        $permissions = [];
        foreach ($this->many('SELECT rp.role_id,p.code,p.description FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.organization_id=? ORDER BY p.code', 'i', [$orgId]) as $p) {
            $permissions[(int) $p['role_id']][] = ['code' => (string) $p['code'], 'description' => (string) $p['description']];
        }
        return array_map(static fn ($r) => [
            'code' => $r['code'], 'name' => $r['name'], 'users' => (int) $r['user_count'],
            'description' => $r['description'], 'is_system' => (bool) $r['is_system'], 'permissions' => $permissions[(int) $r['id']] ?? [],
        ], $this->many('SELECT r.id,r.code,r.name,r.description,r.is_system,COUNT(ur.user_id) AS user_count FROM roles r LEFT JOIN user_roles ur ON ur.organization_id=r.organization_id AND ur.role_id=r.id WHERE r.organization_id=? GROUP BY r.id ORDER BY r.name', 'i', [$orgId]));
    }

    private function uuid(): string
    {
        $v = bin2hex(random_bytes(16));
        $v[12] = '4';
        $v[16] = dechex((hexdec($v[16]) & 3) | 8);
        return substr($v, 0, 8) . '-' . substr($v, 8, 4) . '-' . substr($v, 12, 4) . '-' . substr($v, 16, 4) . '-' . substr($v, 20);
    }
}
