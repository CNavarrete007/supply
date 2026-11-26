<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Database\SessionContract;
use mysqli;
use mysqli_result;
use RuntimeException;
use Throwable;

/**
 * Cotizaciones · base de las escrituras con la cuenta SQL dedicada supplyflow_quotewrite_local (mínimo privilegio):
 * conexión, contrato de permisos, diagnóstico, idempotencia, bloqueos, eventos de flujo y bitácora (módulo quotes).
 * La usan RfqWriteRepository (tarjeta 2, registro de la RFQ), SupplierQuoteWriteRepository (tarjeta 4, cotización recibida) y
 * CustomerQuoteWriteRepository (tarjeta 6, borrador interno de la cotización al cliente).
 * Las excepciones de estas escrituras viven aquí para estar disponibles en cuanto se carga cualquiera de las dos.
 */
abstract class QuoteWriteBase
{
    /** Contrato de permisos (debe coincidir con docker/supply-quotewrite/provision.py; tests/quotewrite_contract_check.py). */
    public const GRANTS = [
        'SELECT' => ['approval_policy_versions', 'awards', 'business_entities', 'currencies', 'customer_quote_items', 'customer_quote_versions', 'entity_files', 'files', 'idempotency_keys', 'people',
            'requisition_items', 'requisition_reviews', 'requisitions', 'rfq_items', 'rfqs', 'roles', 'supplier_quote_items', 'supplier_quotes', 'suppliers', 'user_roles', 'users'],
        'INSERT' => ['audit_events', 'business_entities', 'customer_quote_items', 'customer_quote_versions', 'customer_quotes', 'entity_files', 'files', 'idempotency_keys', 'rfq_items', 'rfqs',
            'supplier_quote_items', 'supplier_quotes', 'workflow_events'],
        'UPDATE' => ['idempotency_keys'],
    ];
    public const COLUMN_GRANTS = [
        'supplier_quotes' => ['currency_code', 'document_score', 'lead_days', 'notes', 'payment_terms', 'quote_date', 'subtotal_amount', 'supplier_reference', 'tax_amount', 'tax_rate_pct', 'technical_score', 'total_amount', 'valid_until'],
        'supplier_quote_items' => ['line_subtotal', 'offered', 'quantity', 'unit_price'],
        'business_entities' => ['row_version', 'updated_at', 'updated_by'],
        'entity_files' => ['file_role'],
        'rfqs' => ['legacy_status', 'status_code'],
        // Tarjeta 6 · borrador interno de la cotización al cliente: datos y montos; NUNCA estatus, emisión, bloqueo ni autorizaciones.
        'customer_quote_versions' => ['approval_evaluation_snapshot', 'approval_policy_snapshot', 'approval_policy_version_id', 'currency_code', 'delivery_place', 'discount_amount', 'discount_kind', 'discount_rate_pct', 'eur_mxn_rate', 'exchange_rate_date', 'exchange_rate_label_snapshot', 'exchange_rate_source', 'exclusions_text', 'inclusions_text', 'lead_time_text', 'notes', 'payment_terms', 'people_snapshots', 'prepared_by', 'quote_date', 'service_fee_base_amount', 'service_fee_comments', 'service_fee_enabled', 'service_fee_rate_pct', 'service_fee_subtotal_amount', 'service_fee_tax_amount', 'service_fee_tax_rate_pct', 'service_fee_total_amount', 'service_fee_unit_price', 'subtotal_amount', 'tax_amount', 'tax_rate_pct', 'third_party_tax_amount', 'third_party_taxable_amount', 'third_party_total_amount', 'total_amount', 'usd_mxn_rate', 'valid_until', 'warranty_text'],
        'customer_quote_items' => ['award_id', 'brand_model', 'charge_pct', 'cost_amount', 'cost_source_text', 'exchange_rate', 'exchange_rate_date', 'exchange_rate_source', 'extra_amount', 'line_subtotal', 'original_cost_amount', 'original_cost_currency', 'quantity', 'unit_price'],
    ];
    private const ACCOUNT_REJECTED_ERRNO = [1044, 1045, 1698];
    protected mysqli $db;
    protected string $root;

    public function __construct(?mysqli $test = null, ?string $testRoot = null)
    {
        $this->root = $testRoot ?? WRITEPATH . 'supplyflow_quotes/files';
        if ($test) {
            $this->db = $test;
            return;
        }
        $user = (string) (getenv('QUOTEWRITE_DB_USERNAME') ?: '');
        $path = (string) (getenv('QUOTEWRITE_DB_PASSWORD_FILE') ?: '');
        if ($user !== 'supplyflow_quotewrite_local' || $path !== '/run/secrets/quotewrite_db_password' || ! is_readable($path)) {
            throw new QuoteWriteUnavailable('QUOTE_WRITE_NOT_PROVISIONED');
        }
        $password = trim((string) file_get_contents($path));
        if (! preg_match('/^[0-9a-f]{64}$/D', $password)) {
            throw new QuoteWriteUnavailable('QUOTE_WRITE_NOT_PROVISIONED');
        }
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        try {
            $this->db = new mysqli((string) (getenv('DB_HOST') ?: 'db'), $user, $password, 'supplyflow_dev', (int) (getenv('DB_PORT') ?: 3306));
            SessionContract::initialize($this->db, 'supplyflow_dev');
        } catch (Throwable $error) {
            $errno = $error instanceof \mysqli_sql_exception ? (int) $error->getCode() : 0;
            throw new QuoteWriteUnavailable(in_array($errno, self::ACCOUNT_REJECTED_ERRNO, true) ? 'QUOTE_WRITE_ACCOUNT_REJECTED' : 'QUOTE_WRITE_UNAVAILABLE', 0, $error);
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

    protected function stmt(string $sql, array $args): \mysqli_stmt
    {
        $s = $this->db->prepare($sql);
        if ($args) {
            $s->bind_param(str_repeat('s', count($args)), ...array_map(static fn ($a) => $a === null ? null : (is_bool($a) ? ($a ? '1' : '0') : (string) $a), $args));
        }
        $s->execute();
        return $s;
    }

    protected function rows(string $sql, array $args = []): array
    {
        $s = $this->stmt($sql, $args);
        try {
            $r = $s->get_result();
            if (! $r instanceof mysqli_result) {
                throw new RuntimeException('QUOTE_QUERY_FAILED');
            }
            return $r->fetch_all(MYSQLI_ASSOC);
        } finally {
            $s->close();
        }
    }

    protected function one(string $sql, array $args = []): ?array
    {
        return $this->rows($sql, $args)[0] ?? null;
    }

    protected function exec(string $sql, array $args = []): int
    {
        $s = $this->stmt($sql, $args);
        try {
            return (int) $s->affected_rows;
        } finally {
            $s->close();
        }
    }

    protected function insert(string $table, array $values): int
    {
        $this->exec('INSERT INTO `' . $table . '` (`' . implode('`,`', array_keys($values)) . '`) VALUES (' . implode(',', array_fill(0, count($values), '?')) . ')', array_values($values));
        return (int) $this->db->insert_id;
    }

    protected static function uuid(): string
    {
        $v = bin2hex(random_bytes(16));
        $v[12] = '4';
        $v[16] = dechex((hexdec($v[16]) & 3) | 8);
        return substr($v, 0, 8) . '-' . substr($v, 8, 4) . '-' . substr($v, 12, 4) . '-' . substr($v, 16, 4) . '-' . substr($v, 20);
    }

    protected static function json(mixed $v): string
    {
        return json_encode($v, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /** Decimal text without trailing zeros ('3.500000' → '3.5'), to compare stored and received values. */
    protected static function dec(mixed $v): string
    {
        if ($v === null || $v === '') {
            return '';
        }
        $s = (string) $v;
        return str_contains($s, '.') ? (rtrim(rtrim($s, '0'), '.') ?: '0') : $s;
    }

    /** Read-only diagnostic: privileges of the contract the account in use does NOT have. */
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

    protected function claim(int $org, int $actor, string $endpoint, string $key, string $hash): ?array
    {
        $digest = hash('sha256', $key, true);
        if ($this->exec("INSERT IGNORE INTO idempotency_keys (organization_id,actor_user_id,endpoint_code,key_sha256,request_sha256,state_code,created_at,expires_at) VALUES (?,?,?,?,?,'processing',UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 30 DAY))", [$org, $actor, $endpoint, $digest, $hash]) === 1) {
            return null;
        }
        $row = $this->one('SELECT request_sha256,state_code,response_json FROM idempotency_keys WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=?', [$org, $actor, $endpoint, $digest]);
        if (! $row || ! hash_equals((string) $row['request_sha256'], $hash)) {
            throw new QuoteConflict('IDEMPOTENCY_CONFLICT', 'La clave de solicitud ya se usó para otro contenido.');
        }
        if ($row['state_code'] !== 'done') {
            throw new QuoteConflict('IDEMPOTENCY_PENDING', 'La operación sigue en proceso. Reintenta en unos segundos.');
        }
        $saved = json_decode((string) $row['response_json'], true);
        if (! is_array($saved)) {
            throw new RuntimeException('REPLAY_UNAVAILABLE');
        }
        $saved['replayed'] = true;
        return $saved;
    }

    protected function finish(int $org, int $actor, string $endpoint, string $key, int $status, array $response): void
    {
        $this->exec("UPDATE idempotency_keys SET state_code='done',response_status=?,response_json=? WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? AND state_code='processing'",
            [$status, self::json($response), $org, $actor, $endpoint, hash('sha256', $key, true)]);
    }

    protected function lock(string $name): void
    {
        if ((int) ($this->one('SELECT GET_LOCK(?,10) AS g', [$name])['g'] ?? 0) !== 1) {
            throw new QuoteConflict('BUSY', 'La operación está ocupada. Reintenta el mismo guardado.');
        }
    }

    protected function unlock(string $name): void
    {
        try {
            $this->one('SELECT RELEASE_LOCK(?) AS r', [$name]);
        } catch (Throwable) {
            // Closing the connection also releases it; never hide the primary error.
        }
    }

    protected function event(int $org, int $entity, int $actor, string $workflow, string $action, ?string $to, array $payload, string $comment): void
    {
        $json = self::json($payload);
        $this->insert('workflow_events', ['organization_id' => $org, 'entity_id' => $entity, 'public_id' => self::uuid(), 'workflow_code' => $workflow, 'action_code' => $action,
            'to_state' => $to, 'actor_user_id' => $actor, 'comment_text' => $comment, 'payload_schema_version' => 1, 'payload_json' => $json,
            'occurred_at' => gmdate('Y-m-d H:i:s'), 'recorded_at' => gmdate('Y-m-d H:i:s'), 'content_sha256' => hash('sha256', $json, true), 'provenance' => 'system']);
    }

    protected function audit(int $org, int $entity, int $actor, string $action, array $detail): void
    {
        $this->insert('audit_events', ['organization_id' => $org, 'public_id' => self::uuid(), 'subject_entity_id' => $entity, 'actor_user_id' => $actor, 'module_code' => 'quotes',
            'action_code' => $action, 'result_code' => 'success', 'occurred_at' => gmdate('Y-m-d H:i:s'), 'recorded_at' => gmdate('Y-m-d H:i:s'), 'changes_json' => self::json($detail), 'source_kind' => 'system']);
    }

    protected function currency(string $code): void
    {
        if (! $this->one('SELECT code FROM currencies WHERE code=? AND active=1', [$code])) {
            throw new QuoteConflict('CURRENCY_UNAVAILABLE', 'La moneda no está activa en el catálogo.', 422, 'currency');
        }
    }
}

final class QuoteWriteUnavailable extends RuntimeException
{
}

final class QuoteConflict extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message, public readonly int $status = 409, public readonly ?string $field = null)
    {
        parent::__construct($message);
    }
}

final class QuoteStale extends RuntimeException
{
}
