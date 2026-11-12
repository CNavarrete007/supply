<?php

declare(strict_types=1);

namespace App\Libraries;

use DateTimeImmutable;
use InvalidArgumentException;

/**
 * Catálogo de clientes · validación estricta del cuerpo JSON de alta/actualización (no confía en el frontend).
 * El portal del cliente y sus claves NO se reciben aquí: requieren el diseño de seguridad de portal_access_tokens.
 */
class ClientInput
{
    public const SALES_POLICIES = ['quote_required', 'guaranteed', 'mixed', 'contract', 'manual'];
    public const SOURCING_POLICIES = ['requote_always', 'validate_history', 'reuse_if_valid'];
    public const STATUSES = ['active', 'inactive', 'blocked'];
    public const LOGO_MAX_BYTES = 400 * 1024;
    private const FIELDS = ['code', 'name', 'brand_name', 'tax_id', 'project', 'contract_reference', 'phone', 'contacts', 'emails',
        'status', 'address', 'terms', 'notes', 'repeat_policy', 'logo'];

    public static function uuidValid(string $v): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iD', $v) === 1;
    }

    protected static function bad(string $field): never
    {
        throw new InvalidArgumentException($field);
    }

    /** Trimmed single-line text without control characters; '' allowed unless $required. */
    protected static function text(array $j, string $k, int $max, bool $required = false, ?string $pattern = null): string
    {
        $v = $j[$k] ?? '';
        if (! is_string($v)) {
            self::bad($k);
        }
        $v = trim(preg_replace('/\s+/u', ' ', $v) ?? '');
        if (($required && $v === '') || mb_strlen($v) > $max || preg_match('/[\x00-\x1F\x7F]/u', $v) === 1 || ! mb_check_encoding($v, 'UTF-8')) {
            self::bad($k);
        }
        if ($v !== '' && $pattern !== null && preg_match($pattern, $v) !== 1) {
            self::bad($k);
        }
        return $v;
    }

    /** Multi-line text (address, terms, notes): keeps line breaks, rejects other control characters. */
    protected static function block(array $j, string $k, int $max): string
    {
        $v = $j[$k] ?? '';
        if (! is_string($v)) {
            self::bad($k);
        }
        $v = trim(str_replace("\r\n", "\n", $v));
        if (mb_strlen($v) > $max || preg_match('/[\x00-\x09\x0B-\x1F\x7F]/u', $v) === 1 || ! mb_check_encoding($v, 'UTF-8')) {
            self::bad($k);
        }
        return $v;
    }

    /** @return list<string> unique (case-insensitive), non-empty, in order */
    protected static function list(array $j, string $k, int $maxItems, int $maxLen, callable $valid): array
    {
        $v = $j[$k] ?? [];
        if (! is_array($v) || ! array_is_list($v) || count($v) > $maxItems) {
            self::bad($k);
        }
        $out = [];
        $seen = [];
        foreach ($v as $item) {
            if (! is_string($item)) {
                self::bad($k);
            }
            $item = trim(preg_replace('/\s+/u', ' ', $item) ?? '');
            if ($item === '') {
                continue;
            }
            if (mb_strlen($item) > $maxLen || preg_match('/[\x00-\x1F\x7F]/u', $item) === 1 || ! $valid($item)) {
                self::bad($k);
            }
            $key = mb_strtolower($item);
            if (! isset($seen[$key])) {
                $seen[$key] = true;
                $out[] = $item;
            }
        }
        return $out;
    }

    /** @return array<string,mixed> */
    public static function payload(mixed $j): array
    {
        if (! is_array($j) || array_is_list($j) || array_diff(array_keys($j), self::FIELDS) !== []) {
            self::bad('body');
        }
        $status = $j['status'] ?? 'active';
        if (! is_string($status) || ! in_array($status, self::STATUSES, true)) {
            self::bad('status');
        }
        return [
            'code' => self::text($j, 'code', 80, true, '/^[\p{L}\p{N}][\p{L}\p{N}._\-\/ ]{0,79}$/uD'),
            'name' => self::text($j, 'name', 255, true),
            'brand_name' => self::text($j, 'brand_name', 255),
            'tax_id' => self::text($j, 'tax_id', 64, false, '/^[\p{L}\p{N}&\-. ]{1,64}$/uD'),
            'project' => self::text($j, 'project', 255, true),
            'contract_reference' => self::text($j, 'contract_reference', 255, true),
            'phones' => self::phones(self::text($j, 'phone', 200)),
            'contacts' => self::list($j, 'contacts', 20, 255, static fn () => true),
            'emails' => self::list($j, 'emails', 20, 254, static fn ($e) => filter_var($e, FILTER_VALIDATE_EMAIL) !== false),
            'status' => $status,
            'address' => self::block($j, 'address', 2000),
            'terms' => self::block($j, 'terms', 2000),
            'notes' => self::block($j, 'notes', 4000),
            'repeat_policy' => self::policy($j['repeat_policy'] ?? []),
            'logo' => self::logo($j['logo'] ?? null),
        ];
    }

    /** One "Teléfono" field may hold several numbers separated by "/", "," or ";" (imported clients keep all of them). */
    protected static function phones(string $v): array
    {
        $out = [];
        foreach (preg_split('/\s*[\/,;]\s*/', $v) ?: [] as $phone) {
            $phone = trim($phone);
            if ($phone === '') {
                continue;
            }
            if (preg_match('/^[0-9+()\-. extEXT]{3,40}$/D', $phone) !== 1 || preg_match('/[0-9]/', $phone) !== 1) {
                self::bad('phone');
            }
            $out[] = $phone;
        }
        if (count($out) > 10) {
            self::bad('phone');
        }
        return array_values(array_unique($out));
    }

    /**
     * Policy codes. A value outside the catalog is accepted only when it equals the value already stored (legacy value
     * kept unchanged); the repository enforces that rule.
     * @return array<string,mixed>
     */
    protected static function policy(mixed $p): array
    {
        $allowed = ['sales_policy', 'sourcing_policy', 'price_validity_days', 'contract_reference', 'contract_valid_until', 'min_margin_pct'];
        if (! is_array($p) || ($p !== [] && array_is_list($p)) || array_diff(array_keys($p), $allowed) !== []) {
            self::bad('repeat_policy');
        }
        $code = static function (string $k) use ($p): string {
            $v = $p[$k] ?? '';
            if (! is_string($v) || mb_strlen($v) > 32 || preg_match('/[\x00-\x1F\x7F]/u', $v) === 1) {
                self::bad('repeat_policy.' . $k);
            }
            return trim($v);
        };
        $days = $p['price_validity_days'] ?? null;
        if ($days === '' ) {
            $days = null;
        }
        if ($days !== null && (! is_int($days) || $days < 0 || $days > 3650)) {
            self::bad('repeat_policy.price_validity_days');
        }
        $until = $p['contract_valid_until'] ?? null;
        if ($until === '') {
            $until = null;
        }
        if ($until !== null) {
            $d = is_string($until) ? DateTimeImmutable::createFromFormat('!Y-m-d', $until) : false;
            if (! $d || $d->format('Y-m-d') !== $until || $until < '2000-01-01' || $until > '2100-12-31') {
                self::bad('repeat_policy.contract_valid_until');
            }
        }
        $margin = $p['min_margin_pct'] ?? null;
        if ($margin === '') {
            $margin = null;
        }
        if ($margin !== null) {
            if ((! is_int($margin) && ! is_float($margin) && ! (is_string($margin) && is_numeric($margin))) || (float) $margin < 0 || (float) $margin > 100) {
                self::bad('repeat_policy.min_margin_pct');
            }
            $margin = number_format(round((float) $margin, 4), 4, '.', '');
        }
        $ref = $p['contract_reference'] ?? '';
        if (! is_string($ref) || mb_strlen(trim($ref)) > 255 || preg_match('/[\x00-\x1F\x7F]/u', $ref) === 1) {
            self::bad('repeat_policy.contract_reference');
        }
        return ['sales_policy' => $code('sales_policy'), 'sourcing_policy' => $code('sourcing_policy'), 'price_validity_days' => $days,
            'contract_reference' => trim($ref), 'contract_valid_until' => $until, 'min_margin_pct' => $margin];
    }

    /**
     * null = keep; ['remove' => true] = remove; ['data' => data-URL, 'name' => file name] = new PNG/JPEG/WEBP (≤ 400 KB,
     * ≤ 4096 px). The type comes from the bytes, never from the declared MIME or the file name.
     * @return array<string,mixed>|null
     */
    protected static function logo(mixed $l): ?array
    {
        if ($l === null) {
            return null;
        }
        if (! is_array($l) || array_is_list($l)) {
            self::bad('logo');
        }
        if (array_keys($l) === ['remove'] && $l['remove'] === true) {
            return ['remove' => true];
        }
        if (array_diff(array_keys($l), ['data', 'name']) !== [] || ! is_string($l['data'] ?? null)) {
            self::bad('logo');
        }
        if (preg_match('~^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$~D', $l['data'], $m) !== 1) {
            self::bad('logo');
        }
        $bytes = base64_decode($m[2], true);
        if ($bytes === false || $bytes === '' || strlen($bytes) > self::LOGO_MAX_BYTES) {
            self::bad('logo');
        }
        $info = self::image($bytes);
        if ($info === null) {
            self::bad('logo');
        }
        $name = is_string($l['name'] ?? null) ? trim($l['name']) : '';
        $name = preg_replace('/[^\p{L}\p{N}._\- ]/u', '_', $name) ?? '';
        $name = mb_substr($name !== '' ? $name : 'logotipo', 0, 120);
        $name = preg_replace('/\.[A-Za-z0-9]{1,5}$/', '', $name) . '.' . $info['ext'];
        return ['bytes' => $bytes, 'mime' => $info['mime'], 'ext' => $info['ext'], 'width' => $info['width'], 'height' => $info['height'], 'name' => $name];
    }

    /** Detects PNG/JPEG/WEBP from the bytes and reads the dimensions (no GD required). */
    public static function image(string $b): ?array
    {
        $dims = null;
        if (str_starts_with($b, "\x89PNG\r\n\x1A\n") && substr($b, 12, 4) === 'IHDR' && strlen($b) >= 24) {
            $u = unpack('Nw/Nh', substr($b, 16, 8));
            $dims = ['mime' => 'image/png', 'ext' => 'png', 'width' => $u['w'], 'height' => $u['h']];
        } elseif (str_starts_with($b, "\xFF\xD8\xFF")) {
            $i = 2;
            $n = strlen($b);
            while ($i + 9 < $n) {
                if ($b[$i] !== "\xFF") {
                    return null;
                }
                $marker = ord($b[$i + 1]);
                if ($marker === 0xD8 || $marker === 0x01 || ($marker >= 0xD0 && $marker <= 0xD7)) {
                    $i += 2;
                    continue;
                }
                $len = unpack('n', substr($b, $i + 2, 2))[1];
                if (in_array($marker, [0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF], true)) {
                    $u = unpack('nh/nw', substr($b, $i + 5, 4));
                    $dims = ['mime' => 'image/jpeg', 'ext' => 'jpg', 'width' => $u['w'], 'height' => $u['h']];
                    break;
                }
                $i += 2 + $len;
            }
        } elseif (str_starts_with($b, 'RIFF') && substr($b, 8, 4) === 'WEBP' && strlen($b) >= 30) {
            $chunk = substr($b, 12, 4);
            if ($chunk === 'VP8X') {
                $w = 1 + (ord($b[24]) | ord($b[25]) << 8 | ord($b[26]) << 16);
                $h = 1 + (ord($b[27]) | ord($b[28]) << 8 | ord($b[29]) << 16);
            } elseif ($chunk === 'VP8 ' && substr($b, 23, 3) === "\x9D\x01\x2A") {
                $u = unpack('vw/vh', substr($b, 26, 4));
                [$w, $h] = [$u['w'] & 0x3FFF, $u['h'] & 0x3FFF];
            } elseif ($chunk === 'VP8L' && ord($b[20]) === 0x2F) {
                $bits = unpack('V', substr($b, 21, 4))[1];
                [$w, $h] = [($bits & 0x3FFF) + 1, (($bits >> 14) & 0x3FFF) + 1];
            } else {
                return null;
            }
            $dims = ['mime' => 'image/webp', 'ext' => 'webp', 'width' => $w, 'height' => $h];
        }
        if ($dims === null || $dims['width'] < 1 || $dims['height'] < 1 || $dims['width'] > 4096 || $dims['height'] > 4096) {
            return null;
        }
        return $dims;
    }
}
