<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Database\SessionContract;
use mysqli;
use mysqli_result;
use RuntimeException;
use Throwable;

/**
 * Catálogos (clientes y proveedores) · base común de escritura con la cuenta SQL dedicada supplyflow_catalogwrite_local
 * (mínimo privilegio): conexión, idempotencia, conciliación de contactos y canales, logotipo privado direccionado por
 * SHA-256 y auditoría. Cada subclase define su tabla, su validación de negocio y el rol del logotipo.
 */
abstract class CatalogWriteBase
{
    public const STORAGE = 'supplyflow_catalog_private_v1';
    protected const LOGO_ROLE = '';
    protected const LOGO_KEY = '';
    protected mysqli $db;
    protected string $root;

    public function __construct(?mysqli $test = null, ?string $testRoot = null)
    {
        $this->root = $testRoot ?? WRITEPATH . 'supplyflow_catalog/files';
        if ($test) {
            $this->db = $test;
            return;
        }
        $user = (string) (getenv('CATALOGWRITE_DB_USERNAME') ?: '');
        $path = (string) (getenv('CATALOGWRITE_DB_PASSWORD_FILE') ?: '');
        if ($user !== 'supplyflow_catalogwrite_local' || $path !== '/run/secrets/catalogwrite_db_password' || ! is_readable($path)) {
            throw new CatalogWriteUnavailable('CATALOG_WRITE_NOT_PROVISIONED');
        }
        $password = trim((string) file_get_contents($path));
        if (! preg_match('/^[0-9a-f]{64}$/D', $password)) {
            throw new CatalogWriteUnavailable('CATALOG_WRITE_NOT_PROVISIONED');
        }
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        try {
            $this->db = new mysqli((string) (getenv('DB_HOST') ?: 'db'), $user, $password, 'supplyflow_dev', (int) (getenv('DB_PORT') ?: 3306));
            SessionContract::initialize($this->db, 'supplyflow_dev');
        } catch (Throwable $error) {
            throw new CatalogWriteUnavailable('CATALOG_WRITE_UNAVAILABLE', 0, $error);
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

    protected function stmt(string $sql, string $types, array $args): \mysqli_stmt
    {
        $s = $this->db->prepare($sql);
        if ($types !== '') {
            $s->bind_param($types, ...$args);
        }
        $s->execute();
        return $s;
    }

    protected function one(string $sql, string $types = '', array $args = []): ?array
    {
        $s = $this->stmt($sql, $types, $args);
        try {
            $r = $s->get_result();
            if (! $r instanceof mysqli_result) {
                throw new RuntimeException('CLIENT_QUERY_FAILED');
            }
            return $r->fetch_assoc() ?: null;
        } finally {
            $s->close();
        }
    }

    protected function rows(string $sql, string $types = '', array $args = []): array
    {
        $s = $this->stmt($sql, $types, $args);
        try {
            $r = $s->get_result();
            if (! $r instanceof mysqli_result) {
                throw new RuntimeException('CLIENT_QUERY_FAILED');
            }
            return $r->fetch_all(MYSQLI_ASSOC);
        } finally {
            $s->close();
        }
    }

    protected function exec(string $sql, string $types = '', array $args = []): int
    {
        $s = $this->stmt($sql, $types, $args);
        try {
            return (int) $s->affected_rows;
        } finally {
            $s->close();
        }
    }

    protected static function uuid(): string
    {
        $v = bin2hex(random_bytes(16));
        $v[12] = '4';
        $v[16] = dechex((hexdec($v[16]) & 3) | 8);
        return substr($v, 0, 8) . '-' . substr($v, 8, 4) . '-' . substr($v, 12, 4) . '-' . substr($v, 16, 4) . '-' . substr($v, 20);
    }

    /** Request fingerprint without the logo bytes (their SHA-256 stands in for them). */
    protected static function fingerprint(array $p): string
    {
        $copy = $p;
        if (isset($copy['logo']['bytes'])) {
            $copy['logo'] = ['sha256' => hash('sha256', $copy['logo']['bytes']), 'name' => $copy['logo']['name']];
        }
        return hash('sha256', json_encode($copy, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), true);
    }

    protected function idempotency(int $org, int $actor, string $endpoint, string $key, string $hash): ?array
    {
        $digest = hash('sha256', $key, true);
        if ($this->exec("INSERT IGNORE INTO idempotency_keys (organization_id,actor_user_id,endpoint_code,key_sha256,request_sha256,state_code,created_at,expires_at) VALUES (?,?,?,?,?,'processing',UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 30 DAY))", 'iisss', [$org, $actor, $endpoint, $digest, $hash]) === 1) {
            return null;
        }
        $row = $this->one('SELECT request_sha256,state_code,response_json FROM idempotency_keys WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? FOR UPDATE', 'iiss', [$org, $actor, $endpoint, $digest]);
        if (! $row || ! hash_equals((string) $row['request_sha256'], $hash)) {
            throw new CatalogConflict('IDEMPOTENCY_CONFLICT', 'La clave de solicitud ya se usó para otro contenido.');
        }
        if ($row['state_code'] !== 'done') {
            throw new CatalogConflict('IDEMPOTENCY_PENDING', 'La operación sigue en proceso.');
        }
        $saved = json_decode((string) $row['response_json'], true);
        if (! is_array($saved) || ! isset($saved['id'])) {
            throw new RuntimeException('REPLAY_UNAVAILABLE');
        }
        $saved['replayed'] = true;
        return $saved;
    }

    protected function finish(int $org, int $actor, string $endpoint, string $key, array $response): void
    {
        $this->exec("UPDATE idempotency_keys SET state_code='done',response_status=200,response_json=? WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? AND state_code='processing'", 'siiss', [json_encode($response, JSON_THROW_ON_ERROR), $org, $actor, $endpoint, hash('sha256', $key, true)]);
    }

    protected function audit(int $org, int $entity, int $actor, string $action, array $detail): void
    {
        $this->exec("INSERT INTO audit_events (organization_id,public_id,subject_entity_id,actor_user_id,module_code,action_code,result_code,occurred_at,recorded_at,changes_json,source_kind) VALUES (?,?,?,?,'catalogs',?,'success',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),?,'system')",
            'isiiss', [$org, self::uuid(), $entity, $actor, $action, json_encode($detail, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
    }

    /** Contacts: keep matching names, deactivate removed ones, insert new ones; order = list order (first is primary). */
    protected function syncContacts(int $org, int $entity, array $names): void
    {
        $current = $this->rows('SELECT id,display_name,active FROM party_contacts WHERE organization_id=? AND owner_entity_id=? FOR UPDATE', 'ii', [$org, $entity]);
        $byName = [];
        foreach ($current as $c) {
            $byName[mb_strtolower(trim((string) $c['display_name']))] ??= $c;
        }
        $keep = [];
        foreach ($names as $i => $name) {
            $k = mb_strtolower($name);
            if (isset($byName[$k])) {
                $keep[(int) $byName[$k]['id']] = true;
                $this->exec('UPDATE party_contacts SET active=1,is_primary=?,source_ordinal=? WHERE organization_id=? AND id=?', 'iiii', [$i === 0 ? 1 : 0, $i + 1, $org, (int) $byName[$k]['id']]);
            } else {
                $this->exec('INSERT INTO party_contacts (organization_id,owner_entity_id,public_id,display_name,source_ordinal,is_primary,active) VALUES (?,?,?,?,?,?,1)', 'iissii', [$org, $entity, self::uuid(), $name, $i + 1, $i === 0 ? 1 : 0]);
            }
        }
        foreach ($current as $c) {
            if (! isset($keep[(int) $c['id']]) && (int) $c['active'] === 1) {
                $this->exec('UPDATE party_contacts SET active=0,is_primary=0 WHERE organization_id=? AND id=?', 'ii', [$org, (int) $c['id']]);
            }
        }
    }

    /** Channels of one type reconciled by normalized value (keeps contact links of the values that remain). */
    protected function syncChannels(int $org, int $entity, string $type, array $values): void
    {
        $norm = static fn (string $v) => $type === 'email' ? mb_strtolower(trim($v)) : preg_replace('/[^0-9+]/', '', $v);
        $current = $this->rows('SELECT id,value FROM party_contact_channels WHERE organization_id=? AND owner_entity_id=? AND channel_type=? FOR UPDATE', 'iis', [$org, $entity, $type]);
        $byValue = [];
        foreach ($current as $c) {
            $byValue[$norm((string) $c['value'])] ??= $c;
        }
        $keep = [];
        foreach ($values as $i => $value) {
            $k = $norm($value);
            if (isset($byValue[$k]) && ! isset($keep[(int) $byValue[$k]['id']])) {
                $keep[(int) $byValue[$k]['id']] = true;
                $this->exec('UPDATE party_contact_channels SET value=?,normalized_value=?,is_primary=?,source_ordinal=? WHERE organization_id=? AND id=?', 'ssiiii', [$value, $k, $i === 0 ? 1 : 0, $i + 1, $org, (int) $byValue[$k]['id']]);
            } else {
                $this->exec('INSERT INTO party_contact_channels (organization_id,owner_entity_id,channel_type,value,normalized_value,source_ordinal,source_field,is_primary) VALUES (?,?,?,?,?,?,?,?)', 'iisssisi', [$org, $entity, $type, $value, $k, $i + 1, $type, $i === 0 ? 1 : 0]);
            }
        }
        foreach ($current as $c) {
            if (! isset($keep[(int) $c['id']])) {
                $this->exec('DELETE FROM party_contact_channels WHERE organization_id=? AND id=?', 'ii', [$org, (int) $c['id']]);
            }
        }
    }

    /** New logo: content-addressed private file (reused if identical), previous logo kept as history. */
    protected function saveLogo(int $org, int $entity, int $actor, ?array $logo): void
    {
        if ($logo === null) {
            return;
        }
        $this->exec('UPDATE entity_files SET file_role=? WHERE organization_id=? AND entity_id=? AND file_role=?', 'siis', [static::LOGO_ROLE . (isset($logo['remove']) ? 'Removed' : 'Replaced'), $org, $entity, static::LOGO_ROLE]);
        if (isset($logo['remove'])) {
            return;
        }
        $sha = hash('sha256', $logo['bytes']);
        $size = strlen($logo['bytes']);
        $file = $this->one('SELECT id,storage_backend,storage_key FROM files WHERE organization_id=? AND sha256=? AND size_bytes=?', 'isi', [$org, hex2bin($sha), $size]);
        if ($file && $file['storage_backend'] !== self::STORAGE) {
            throw new CatalogConflict('LOGO_CONFLICT', 'Ese archivo ya existe con otro uso; elige otra imagen.');
        }
        $key = $org . '/' . $sha . '.' . $logo['ext'];
        $path = $this->root . '/' . $key;
        if (! is_file($path) || hash_file('sha256', $path) !== $sha) {
            $dir = dirname($path);
            if (! is_dir($dir) && ! mkdir($dir, 0700, true) && ! is_dir($dir)) {
                throw new RuntimeException('LOGO_STORAGE_UNAVAILABLE');
            }
            $tmp = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';
            if (file_put_contents($tmp, $logo['bytes'], LOCK_EX) !== $size || ! rename($tmp, $path)) {
                @unlink($tmp);
                throw new RuntimeException('LOGO_STORAGE_UNAVAILABLE');
            }
            @chmod($path, 0600);
        }
        if (! $file) {
            $this->exec("INSERT INTO files (organization_id,public_id,storage_backend,storage_key,detected_mime,size_bytes,sha256,scan_status,created_by,created_at) VALUES (?,?,?,?,?,?,?,'clean',?,UTC_TIMESTAMP(6))",
                'issssisi', [$org, self::uuid(), self::STORAGE, $key, $logo['mime'], $size, hex2bin($sha), $actor]);
            $fileId = (int) $this->db->insert_id;
        } else {
            $fileId = (int) $file['id'];
        }
        $this->exec('INSERT INTO entity_files (organization_id,entity_id,file_id,association_key,file_role,original_filename,declared_mime,declared_size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',
            'iiissssi', [$org, $entity, $fileId, static::LOGO_KEY . self::uuid(), static::LOGO_ROLE, $logo['name'], $logo['mime'], $size]);
    }

    protected static function diff(array $before, array $after): array
    {
        $changes = [];
        foreach ($after as $k => $v) {
            if (($before[$k] ?? null) != $v) {
                $changes[$k] = ['from' => $before[$k] ?? null, 'to' => $v];
            }
        }
        return $changes;
    }

    /** Current logo file public id (for audit snapshots). */
    protected function logoFile(int $org, int $id): ?string
    {
        $logo = $this->one('SELECT f.public_id FROM entity_files ef JOIN files f ON f.id=ef.file_id AND f.organization_id=ef.organization_id WHERE ef.organization_id=? AND ef.entity_id=? AND ef.file_role=? ORDER BY ef.id DESC LIMIT 1', 'iis', [$org, $id, static::LOGO_ROLE]);
        return $logo['public_id'] ?? null;
    }
}
