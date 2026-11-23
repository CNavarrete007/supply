<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

/**
 * Configuración · pestañas 1 a 5, SOLO LECTURA (SELECT). Fuente: los grupos de organization_settings que importó el
 * sistema original (legacy_branding, legacy_localization, legacy_organization, legacy_purchasing, legacy_quote_policy,
 * legacy_quote_conditions, legacy_email), la política versionada approval_policy_versions, currencies, units,
 * document_sequences y el historial email_delivery_logs. No expone credenciales ni datos de contacto del contratista,
 * ni el prompt/endpoint de IA (legacy_ai no tiene pantalla). Guardar configuración NO está expuesto.
 */
final class SettingsReadRepository
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

    private const GROUPS = ['legacy_branding', 'legacy_localization', 'legacy_organization', 'legacy_purchasing', 'legacy_quote_policy', 'legacy_quote_conditions', 'legacy_email', 'legacy_counters'];

    /** @return array<string,array{json:array<string,mixed>,updated_at:?string,updated_by:?string}> */
    private function groups(int $org): array
    {
        $in = implode(',', array_fill(0, count(self::GROUPS), '?'));
        $out = [];
        foreach ($this->rows(
            "SELECT s.settings_group,s.settings_json,s.updated_at,
                    (SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=s.updated_by AND u.organization_id=s.organization_id) AS updated_by
             FROM organization_settings s WHERE s.organization_id=? AND s.settings_group IN ({$in})",
            [$org, ...self::GROUPS]
        ) as $r) {
            $j = json_decode((string) $r['settings_json'], true);
            $out[$r['settings_group']] = ['json' => is_array($j) ? $j : [], 'updated_at' => $r['updated_at'], 'updated_by' => $r['updated_by']];
        }
        return $out;
    }

    private static function str(array $j, string $k): ?string
    {
        return isset($j[$k]) && is_scalar($j[$k]) && trim((string) $j[$k]) !== '' ? trim((string) $j[$k]) : null;
    }

    private static function num(array $j, string $k): ?float
    {
        return isset($j[$k]) && is_numeric($j[$k]) ? (float) $j[$k] : null;
    }

    private static function bool(array $j, string $k): ?bool
    {
        return isset($j[$k]) && is_bool($j[$k]) ? $j[$k] : null;
    }

    /** Referencia del logotipo del contratista (legacy_organization.contractorLogo._media.file_id → files.id). */
    private function logoRow(int $org, array $organization): ?array
    {
        $fid = $organization['contractorLogo']['_media']['file_id'] ?? null;
        if (! is_int($fid) && ! (is_string($fid) && ctype_digit($fid))) {
            return null;
        }
        return $this->rows('SELECT id,storage_backend,storage_key,detected_mime,size_bytes,HEX(sha256) AS sha256,scan_status FROM files WHERE organization_id=? AND id=?', [$org, (int) $fid])[0] ?? null;
    }

    /** @return array<string,mixed> */
    public function settings(int $org): array
    {
        $g = $this->groups($org);
        $b = $g['legacy_branding']['json'] ?? [];
        $l = $g['legacy_localization']['json'] ?? [];
        $o = $g['legacy_organization']['json'] ?? [];
        $p = $g['legacy_purchasing']['json'] ?? [];
        $q = $g['legacy_quote_policy']['json'] ?? [];
        $c = $g['legacy_quote_conditions']['json'] ?? [];
        $e = $g['legacy_email']['json'] ?? [];
        $logo = $this->logoRow($org, $o);
        $conditions = [];
        foreach (is_array($c['customerQuoteDefaultConditions'] ?? null) ? $c['customerQuoteDefaultConditions'] : [] as $x) {
            if (is_array($x)) {
                $conditions[] = ['active' => (bool) ($x['active'] ?? false), 'es' => is_string($x['es'] ?? null) ? $x['es'] : '', 'en' => is_string($x['en'] ?? null) ? $x['en'] : ''];
            }
        }
        $policy = $this->rows(
            "SELECT version_number,enabled,currency_code AS currency,unit_price_limit,document_limit,total_basis,comparison_operator,effective_from,effective_until
             FROM approval_policy_versions WHERE organization_id=? AND applies_to='customer_quote'
               AND (effective_from IS NULL OR effective_from<=UTC_TIMESTAMP()) AND (effective_until IS NULL OR effective_until>=UTC_TIMESTAMP())
             ORDER BY version_number DESC,id DESC LIMIT 1",
            [$org]
        )[0] ?? null;
        if ($policy) {
            $policy['version_number'] = (int) $policy['version_number'];
            $policy['enabled'] = (bool) $policy['enabled'];
            foreach (['unit_price_limit', 'document_limit'] as $k) {
                $policy[$k] = $policy[$k] === null ? null : (float) $policy[$k];
            }
        }
        $meta = [];
        foreach ($g as $name => $x) {
            if ($name !== 'legacy_counters') {
                $meta[$name] = ['updated_at' => $x['updated_at'], 'updated_by' => $x['updated_by']];
            }
        }
        $counters = [];
        foreach ($g['legacy_counters']['json'] ?? [] as $k => $v) {
            if (is_int($v)) {
                $counters[(string) $k] = $v;
            }
        }
        return [
            'identity' => [
                'system_name' => self::str($b, 'systemName'), 'slogan' => self::str($b, 'systemSlogan'), 'company' => self::str($b, 'company'),
                'document_language' => self::str($l, 'documentLanguage'), 'client_document_language' => self::str($l, 'clientDocumentLanguage'),
                'supplier_document_language' => self::str($l, 'supplierDocumentLanguage'),
                'logo' => ['configured' => $logo !== null, 'quarantined' => ($logo['scan_status'] ?? '') === 'quarantined'],
            ],
            'parameters' => [
                'currency' => self::str($p, 'currency'), 'req_prefix' => self::str($p, 'reqPrefix'), 'po_prefix' => self::str($p, 'poPrefix'),
                'alert_days' => self::num($p, 'alertDays'), 'min_quotes' => self::num($p, 'minQuotes'), 'tax_pct' => self::num($p, 'tax'),
                'counters' => (object) $counters,
                'sequences' => array_map(static fn ($r) => ['document_kind' => $r['document_kind'], 'series_code' => $r['series_code'], 'period_key' => $r['period_key'], 'next_value' => (int) $r['next_value']],
                    $this->rows('SELECT document_kind,series_code,period_key,next_value FROM document_sequences WHERE organization_id=? ORDER BY document_kind,series_code,period_key', [$org])),
            ],
            'approvals' => [
                'enabled' => self::bool($q, 'customerQuoteApprovalEnabled'), 'currency' => self::str($q, 'customerQuoteApprovalCurrency'),
                'item_limit' => self::num($q, 'customerQuoteItemApprovalLimit'), 'total_limit' => self::num($q, 'customerQuoteTotalApprovalLimit'),
                'total_base' => self::str($q, 'customerQuoteApprovalTotalBase'), 'updated_at' => self::str($q, 'customerQuoteApprovalUpdatedAt'),
                'updated_by' => self::str($q, 'customerQuoteApprovalUpdatedBy'), 'policy' => $policy,
            ],
            'conditions' => $conditions,
            'email' => [
                'internal_enabled' => self::bool($e, 'emailInternalEnabled'), 'cc_buyer' => self::bool($e, 'emailCcBuyer'), 'cc_admin' => self::bool($e, 'emailCcAdmin'),
                'client_enabled' => self::bool($e, 'emailClientEnabled'), 'req_created' => self::bool($e, 'emailReqCreated'), 'process_updates' => self::bool($e, 'emailProcessUpdates'),
                'quote_client' => self::bool($e, 'emailQuoteClient'), 'delivery' => self::bool($e, 'emailDelivery'), 'invoice' => self::bool($e, 'emailInvoice'),
                'sender_name' => self::str($e, 'emailSenderName'), 'reply_to' => self::str($e, 'emailReplyTo'), 'client_language' => self::str($e, 'emailClientLanguage'),
                'max_recipients' => self::num($e, 'emailMaxRecipients'),
            ],
            'currencies' => array_map(static fn ($r) => ['code' => $r['code'], 'name' => $r['name'], 'active' => (bool) $r['active']], $this->rows('SELECT code,name,active FROM currencies ORDER BY code')),
            'units' => (int) ($this->rows('SELECT COUNT(*) AS n FROM units WHERE organization_id=?', [$org])[0]['n'] ?? 0),
            'meta' => (object) $meta,
            'read_only' => true,
            'write_enabled' => false,
        ];
    }

    /**
     * Historial de correos (email_delivery_logs), más reciente primero. f: q (evento, referencia, destinatarios, resultado,
     * detalle), status ('' = todos; estatus mostrado = estado del original o código), page, page_size.
     * @return array<string,mixed>
     */
    public function emailLog(int $org, array $f): array
    {
        $st = "COALESCE(NULLIF(TRIM(l.legacy_status),''),l.status_code)";
        $w = 'l.organization_id=?';
        $b = [$org];
        if ($f['status'] !== '') { $w .= " AND {$st}=?"; $b[] = $f['status']; }
        if ($f['q'] !== '') {
            $like = '%' . strtr($f['q'], ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
            $w .= " AND (l.event_type LIKE ? ESCAPE '!' OR l.reference_text LIKE ? ESCAPE '!' OR CAST(l.recipients_snapshot AS CHAR) LIKE ? ESCAPE '!' OR {$st} LIKE ? ESCAPE '!' OR l.detail_text LIKE ? ESCAPE '!')";
            array_push($b, $like, $like, $like, $like, $like);
        }
        $total = (int) ($this->rows("SELECT COUNT(*) AS n FROM email_delivery_logs l WHERE {$w}", $b)[0]['n'] ?? 0);
        $size = $f['page_size'];
        $off = ($f['page'] - 1) * $size;
        $items = [];
        foreach ($this->rows("SELECT l.occurred_at,l.event_type,l.reference_text,l.recipients_snapshot,{$st} AS status,l.detail_text,l.attempt_number
                FROM email_delivery_logs l WHERE {$w} ORDER BY l.occurred_at DESC,l.id DESC LIMIT {$size} OFFSET {$off}", $b) as $r) {
            $rec = json_decode((string) $r['recipients_snapshot'], true);
            $lines = [];
            foreach (['to' => 'Para', 'cc' => 'CC', 'bcc' => 'CCO'] as $k => $label) {
                foreach (is_array($rec[$k] ?? null) ? $rec[$k] : (is_string($rec[$k] ?? null) ? [$rec[$k]] : []) as $addr) {
                    if (is_string($addr) && trim($addr) !== '') {
                        $lines[] = ['kind' => $label, 'address' => trim($addr)];
                    }
                }
            }
            $items[] = ['occurred_at' => $r['occurred_at'], 'event' => $r['event_type'], 'reference' => $r['reference_text'], 'recipients' => $lines,
                'status' => $r['status'], 'detail' => $r['detail_text'], 'attempt' => $r['attempt_number'] === null ? null : (int) $r['attempt_number']];
        }
        $statuses = array_map(static fn ($r) => ['status' => $r['s'], 'count' => (int) $r['n']], $this->rows("SELECT {$st} AS s,COUNT(*) AS n FROM email_delivery_logs l WHERE l.organization_id=? GROUP BY s ORDER BY s", [$org]));
        return ['items' => $items, 'total' => $total, 'page' => $f['page'], 'page_size' => $size, 'statuses' => $statuses,
            'all' => array_sum(array_column($statuses, 'count'))];
    }

    /**
     * Archivo del logotipo verificado (almacenamiento privado de catálogos o archivos importados del original).
     * @return array{bytes:string,mime:string,ext:string}|null
     */
    public function logo(int $org): ?array
    {
        $o = $this->groups($org)['legacy_organization']['json'] ?? [];
        $f = $this->logoRow($org, $o);
        if (! $f || $f['scan_status'] === 'quarantined') {
            return null;
        }
        $path = null;
        if ($f['storage_backend'] === CatalogWriteBase::STORAGE && preg_match('~^[1-9][0-9]*/[a-f0-9]{64}\.(png|jpg|webp)$~D', (string) $f['storage_key'])) {
            $path = WRITEPATH . 'supplyflow_catalog/files/' . $f['storage_key'];
        } elseif ($f['storage_backend'] === 'supplyflow_local_private_v1'
            && preg_match('~^imports/' . RequisitionRecoveryRepository::SOURCE_HASH . '/files/([a-f0-9]{64}\.(?:png|jpg|webp))$~D', (string) $f['storage_key'], $m)) {
            $path = '/run/supply-import-files/' . $m[1];
        }
        if (! $path || ! is_file($path) || is_link($path)) {
            return null;
        }
        $bytes = (string) file_get_contents($path);
        $info = $bytes !== '' ? ClientInput::image($bytes) : null;
        if (! $info || strlen($bytes) !== (int) $f['size_bytes'] || ! hash_equals(strtolower((string) $f['sha256']), hash('sha256', $bytes))) {
            return null;
        }
        return ['bytes' => $bytes, 'mime' => $info['mime'], 'ext' => $info['ext']];
    }
}
