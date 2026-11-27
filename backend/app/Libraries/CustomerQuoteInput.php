<?php

declare(strict_types=1);

namespace App\Libraries;

use DateTimeImmutable;
use InvalidArgumentException;

/**
 * Cotizaciones › Cotización formal al cliente (tarjeta 6) · validación estricta del borrador interno (no confía en el frontend).
 * Mismas reglas que customerQuoteBuilder.mjs validateCq(). El mensaje de cada excepción es el campo (o `line:<id>`). Los costos,
 * precios de venta, impuestos y totales NO se reciben: el servidor toma el costo de la adjudicación vigente o de la oferta
 * registrada y calcula todo con la misma fórmula de la tarjeta.
 */
final class CustomerQuoteInput
{
    private const DEC6 = '/^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/D';
    private const DEC10 = '/^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,10})?$/D';

    private static function bad(string $field): never
    {
        throw new InvalidArgumentException($field);
    }

    public static function uuid(mixed $v): bool
    {
        return is_string($v) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D', $v) === 1;
    }

    private static function text(array $j, string $k, int $max): string
    {
        $v = $j[$k] ?? '';
        if ($v === null) {
            $v = '';
        }
        if (! is_string($v) || preg_match('//u', $v) !== 1 || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $v) === 1) {
            self::bad($k);
        }
        $v = trim(str_replace("\r\n", "\n", $v));
        if (mb_strlen($v) > $max) {
            self::bad($k);
        }
        return $v;
    }

    private static function date(mixed $v, string $field, bool $required): ?string
    {
        if ($v === null || $v === '') {
            if ($required) {
                self::bad($field);
            }
            return null;
        }
        if (! is_string($v) || preg_match('/^\d{4}-\d{2}-\d{2}$/D', $v) !== 1 || ($d = DateTimeImmutable::createFromFormat('!Y-m-d', $v)) === false || $d->format('Y-m-d') !== $v || $v < '2000-01-01') {
            self::bad($field);
        }
        return $v;
    }

    private static function dec(mixed $v, string $field, string $re = self::DEC6): string
    {
        if (is_int($v)) {
            $v = (string) $v;
        }
        if (! is_string($v) || preg_match($re, trim($v)) !== 1) {
            self::bad($field);
        }
        return trim($v);
    }

    private static function pct(mixed $v, string $field, float $max = 100): string
    {
        $d = self::dec($v, $field);
        if ((float) $d > $max) {
            self::bad($field);
        }
        return $d;
    }

    /** Optional exchange rate (MXN per unit): '' / null → null; otherwise a positive decimal with up to 10 places. */
    private static function rate(mixed $v, string $field): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }
        $d = self::dec($v, $field, self::DEC10);
        if ((float) $d <= 0) {
            self::bad($field);
        }
        return $d;
    }

    public static function payload(mixed $j, bool $edit = false): array
    {
        if (! is_array($j) || array_is_list($j)) {
            self::bad('body');
        }
        $allowed = ['requisition_id', 'issue_date', 'valid_until', 'currency', 'preparer_id', 'reviewer_id', 'approver_id', 'lead_time', 'delivery_place', 'payment_terms', 'warranty', 'inclusions', 'exclusions', 'notes',
            'fx_date', 'usd_mxn', 'eur_mxn', 'fx_source', 'discount', 'vat', 'sf_enabled', 'sf_pct', 'sf_comments', 'lines'];
        if (array_diff(array_keys($j), $allowed) !== []) {
            self::bad('body');
        }
        $req = $j['requisition_id'] ?? null;
        if (! $edit && ! self::uuid($req)) {
            self::bad('requisition_id');
        }
        $issue = self::date($j['issue_date'] ?? null, 'issue_date', true);
        $valid = self::date($j['valid_until'] ?? null, 'valid_until', true);
        if ($valid < $issue) {
            self::bad('valid_until');
        }
        $currency = $j['currency'] ?? null;
        if (! is_string($currency) || preg_match('/^[A-Z]{3}$/D', $currency) !== 1) {
            self::bad('currency');
        }
        // Comprador, Revisó y Autorizó (obligatorios): personas ASIGNADAS; la revisión y la autorización no se registran aquí.
        foreach (['preparer_id', 'reviewer_id', 'approver_id'] as $k) {
            if (! self::uuid($j[$k] ?? null)) {
                self::bad($k);
            }
        }
        $sfOn = $j['sf_enabled'] ?? false;
        if (! is_bool($sfOn)) {
            self::bad('sf_enabled');
        }
        $lines = $j['lines'] ?? null;
        if (! is_array($lines) || ! array_is_list($lines) || $lines === [] || count($lines) > 500) {
            self::bad('lines');
        }
        $out = [];
        foreach ($lines as $l) {
            if (! is_array($l) || array_is_list($l) || array_diff(array_keys($l), ['line_id', 'source', 'quote_id', 'qty', 'handling', 'margin', 'brand_model']) !== [] || ! self::uuid($l['line_id'] ?? null)) {
                self::bad('lines');
            }
            $f = 'line:' . $l['line_id'];
            if (isset($out[$l['line_id']])) {
                self::bad('lines');
            }
            if (! in_array($l['source'] ?? null, ['award', 'offer'], true) || ! self::uuid($l['quote_id'] ?? null)) {
                self::bad($f);
            }
            $qty = self::dec($l['qty'] ?? null, $f);
            if ((float) $qty <= 0) {
                self::bad($f);
            }
            $brand = $l['brand_model'] ?? '';
            if ($brand === null) {
                $brand = '';
            }
            if (! is_string($brand) || preg_match('//u', $brand) !== 1 || preg_match('/[\x00-\x1F\x7F]/', $brand) === 1 || mb_strlen(trim($brand)) > 255) {
                self::bad($f);
            }
            $out[$l['line_id']] = ['line_id' => $l['line_id'], 'source' => $l['source'], 'quote_id' => $l['quote_id'], 'qty' => $qty, 'handling' => self::dec($l['handling'] ?? null, $f),
                'margin' => self::pct($l['margin'] ?? null, $f, 1000), 'brand_model' => trim($brand)];
        }
        return [
            'requisition_id' => $edit ? null : $req, 'issue_date' => $issue, 'valid_until' => $valid, 'currency' => $currency, 'preparer_id' => $j['preparer_id'], 'reviewer_id' => $j['reviewer_id'], 'approver_id' => $j['approver_id'],
            'lead_time' => self::text($j, 'lead_time', 500), 'delivery_place' => self::text($j, 'delivery_place', 500), 'payment_terms' => self::text($j, 'payment_terms', 500),
            'warranty' => self::text($j, 'warranty', 500), 'inclusions' => self::text($j, 'inclusions', 4000), 'exclusions' => self::text($j, 'exclusions', 4000), 'notes' => self::text($j, 'notes', 4000),
            'fx_date' => self::date($j['fx_date'] ?? null, 'fx_date', false), 'usd_mxn' => self::rate($j['usd_mxn'] ?? null, 'usd_mxn'), 'eur_mxn' => self::rate($j['eur_mxn'] ?? null, 'eur_mxn'),
            'fx_source' => self::text($j, 'fx_source', 255), 'discount' => self::pct($j['discount'] ?? null, 'discount'), 'vat' => self::pct($j['vat'] ?? null, 'vat'),
            'sf_enabled' => $sfOn, 'sf_pct' => $sfOn ? self::pct($j['sf_pct'] ?? null, 'sf_pct') : '0', 'sf_comments' => $sfOn ? self::text($j, 'sf_comments', 2000) : '',
            'lines' => array_values($out),
        ];
    }

    // ---- Cálculo (misma fórmula que customerQuoteBuilder.mjs; redondeo a centavos igual que el navegador) ----

    /** Math.round((x + Number.EPSILON) * 100) / 100 of the card, for identical cents. */
    public static function r2(float $x): float
    {
        return floor(($x + PHP_FLOAT_EPSILON) * 100 + 0.5) / 100;
    }

    /** MXN per 1 unit of the currency (null when the needed rate is missing). */
    public static function rate2(string $cur, array $p): ?float
    {
        return match ($cur) {
            'MXN' => 1.0,
            'USD' => $p['usd_mxn'] === null ? null : (float) $p['usd_mxn'],
            'EUR' => $p['eur_mxn'] === null ? null : (float) $p['eur_mxn'],
            default => null,
        };
    }

    public static function convert(float $a, string $from, string $to, array $p): ?float
    {
        if ($from === $to) {
            return $a;
        }
        $rf = self::rate2($from, $p);
        $rt = self::rate2($to, $p);
        return $rf && $rt ? ($a * $rf) / $rt : null;
    }

    /** Unit price = (cost × qty + handling) × (1 + margin %) ÷ qty; subtotal = unit × qty (quote currency). */
    public static function priceLine(float $cost, string $costCur, string $qty, string $handling, string $margin, array $p): ?array
    {
        $cu = self::convert($cost, $costCur, $p['currency'], $p);
        $q = (float) $qty;
        if ($cu === null || $q <= 0) {
            return null;
        }
        $unit = self::r2((($cu * $q + (float) $handling) * (1 + (float) $margin / 100)) / $q);
        return ['cost' => $cu, 'unit' => $unit, 'subtotal' => self::r2($unit * $q)];
    }

    public static function totals(array $subtotals, array $p): array
    {
        $third = self::r2(array_reduce($subtotals, static fn ($s, $x) => $s + $x, 0.0));
        $discount = self::r2($third * (float) $p['discount'] / 100);
        $taxable = self::r2($third - $discount);
        $vat = (float) $p['vat'];
        $tax = self::r2($taxable * $vat / 100);
        $thirdTotal = self::r2($taxable + $tax);
        $sfUnit = $p['sf_enabled'] ? self::r2($taxable * (float) $p['sf_pct'] / 100) : 0.0;
        $sfTax = self::r2($sfUnit * $vat / 100);
        $sfTotal = self::r2($sfUnit + $sfTax);
        return ['third' => $third, 'discount' => $discount, 'taxable' => $taxable, 'tax' => $tax, 'thirdTotal' => $thirdTotal, 'sfBase' => $p['sf_enabled'] ? $taxable : 0.0,
            'sfUnit' => $sfUnit, 'sfTax' => $sfTax, 'sfTotal' => $sfTotal, 'subtotal' => self::r2($taxable + $sfUnit), 'total' => self::r2($thirdTotal + $sfTotal)];
    }
}
