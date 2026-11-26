<?php

declare(strict_types=1);

namespace App\Libraries;

use DateTimeImmutable;
use InvalidArgumentException;

/**
 * Cotizaciones › Registro de cotización (tarjeta 4) · validación estricta del cuerpo JSON (no confía en el frontend).
 * Mismas reglas que supplierQuote.mjs validateQuote(). El mensaje de cada excepción es el campo. Los importes NO se reciben:
 * el servidor los calcula (importe = cantidad × precio, IVA e importe total redondeados a centavos, como la tarjeta).
 */
final class SupplierQuoteInput
{
    public const PAYMENT = ['PUE', 'PPD'];
    public const PDF_MAX_BYTES = 8388608; // 8 MB: límite de transporte del gateway (12 MB de cuerpo con base64), igual que RF1

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

    /** Non-negative decimal with up to 6 decimals (as text, for exact arithmetic). */
    private static function dec(mixed $v, string $field): string
    {
        if (is_int($v)) {
            $v = (string) $v;
        }
        if (! is_string($v) || preg_match('/^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/D', trim($v)) !== 1) {
            self::bad($field);
        }
        return trim($v);
    }

    private static function pct(mixed $v, string $field): string
    {
        $d = self::dec($v, $field);
        if ((float) $d > 100 || preg_match('/\.[0-9]{5,}$/D', $d) === 1) {
            self::bad($field);
        }
        return $d;
    }

    public static function payload(mixed $j, bool $edit = false): array
    {
        if (! is_array($j) || array_is_list($j)) {
            self::bad('body');
        }
        $allowed = ['rfq_id', 'supplier_reference', 'quote_date', 'valid_until', 'vat', 'currency', 'lead_days', 'payment', 'technical', 'documentation', 'notes', 'lines', 'document'];
        if (array_diff(array_keys($j), $allowed) !== []) {
            self::bad('body');
        }
        $rfq = $j['rfq_id'] ?? null;
        if (! $edit && ! self::uuid($rfq)) {
            self::bad('rfq_id');
        }
        $quoteDate = self::date($j['quote_date'] ?? null, 'quote_date', true);
        $valid = self::date($j['valid_until'] ?? null, 'valid_until', false);
        if ($valid !== null && $valid < $quoteDate) {
            self::bad('valid_until');
        }
        $lead = $j['lead_days'] ?? null;
        if (is_int($lead)) {
            $lead = (string) $lead;
        }
        if (! is_string($lead) || preg_match('/^\d{1,4}$/D', trim($lead)) !== 1 || (int) $lead > 3650) {
            self::bad('lead_days');
        }
        $currency = $j['currency'] ?? null;
        if (! is_string($currency) || preg_match('/^[A-Z]{3}$/D', $currency) !== 1) {
            self::bad('currency');
        }
        $payment = $j['payment'] ?? '';
        if ($payment !== '' && $payment !== null && ! in_array($payment, self::PAYMENT, true)) {
            self::bad('payment');
        }
        $lines = $j['lines'] ?? null;
        if (! is_array($lines) || ! array_is_list($lines) || $lines === [] || count($lines) > 500) {
            self::bad('lines');
        }
        $out = [];
        $seen = [];
        foreach ($lines as $l) {
            if (! is_array($l) || array_is_list($l) || array_diff(array_keys($l), ['line_number', 'offered', 'qty', 'price']) !== []) {
                self::bad('lines');
            }
            $n = $l['line_number'] ?? null;
            if (! is_int($n) || $n < 1 || isset($seen[$n]) || ! is_bool($l['offered'] ?? null)) {
                self::bad('lines');
            }
            $seen[$n] = true;
            if ($l['offered']) {
                $qty = self::dec($l['qty'] ?? null, 'line:' . $n);
                $price = self::dec($l['price'] ?? null, 'line:' . $n);
                if ((float) $qty <= 0) {
                    self::bad('line:' . $n);
                }
            } else {
                $qty = '0';
                $price = '0';
            }
            $out[] = ['line_number' => $n, 'offered' => $l['offered'], 'qty' => $qty, 'price' => $price];
        }
        if (! array_filter($out, static fn ($l) => $l['offered'])) {
            self::bad('lines');
        }
        $doc = $j['document'] ?? null;
        $document = null;
        if ($doc !== null) {
            if (! is_array($doc) || array_is_list($doc) || array_diff(array_keys($doc), ['name', 'data']) !== [] || ! is_string($doc['data'] ?? null) || ! is_string($doc['name'] ?? null)) {
                self::bad('document');
            }
            if (strlen($doc['data']) > (int) ceil(self::PDF_MAX_BYTES / 3) * 4 + 8) {
                self::bad('document');
            }
            $bytes = base64_decode($doc['data'], true);
            if ($bytes === false || $bytes === '' || strlen($bytes) > self::PDF_MAX_BYTES || ! str_starts_with($bytes, '%PDF-')) {
                self::bad('document');
            }
            $name = trim((string) preg_replace('/[^\p{L}\p{N}._\- ()]/u', '_', $doc['name']));
            $name = mb_substr($name !== '' ? $name : 'cotizacion', 0, 200);
            if (! preg_match('/\.pdf$/i', $name)) {
                $name .= '.pdf';
            }
            $document = ['name' => $name, 'bytes' => $bytes, 'sha256' => hash('sha256', $bytes), 'size' => strlen($bytes)];
        }
        return [
            'rfq_id' => $edit ? null : strtolower($rfq),
            'supplier_reference' => self::text($j, 'supplier_reference', 128),
            'quote_date' => $quoteDate,
            'valid_until' => $valid,
            'vat' => self::pct($j['vat'] ?? null, 'vat'),
            'currency' => $currency,
            'lead_days' => (int) trim($lead),
            'payment' => $payment ?: null,
            'technical' => self::pct($j['technical'] ?? null, 'technical'),
            'documentation' => self::pct($j['documentation'] ?? null, 'documentation'),
            'notes' => self::text($j, 'notes', 4000),
            'lines' => $out,
            'document' => $document,
        ];
    }

    /** Fingerprint for idempotency: the PDF counts by its SHA-256, never by its bytes. */
    public static function fingerprint(array $p): array
    {
        if ($p['document'] !== null) {
            $p['document'] = ['name' => $p['document']['name'], 'sha256' => $p['document']['sha256']];
        }
        return $p;
    }

    /** Cents, as the card (round half away from zero on the decimal value). */
    public static function round2(float $v): float
    {
        return round($v + ($v >= 0 ? PHP_FLOAT_EPSILON : -PHP_FLOAT_EPSILON), 2);
    }

    /** Amounts of the quote computed on the server (same formula as supplierQuote.mjs lineAmounts/quoteTotals). */
    public static function amounts(array $lines, string $vat): array
    {
        $rate = (float) $vat;
        $subtotal = 0.0;
        $tax = 0.0;
        $per = [];
        foreach ($lines as $l) {
            $s = $l['offered'] ? self::round2((float) $l['qty'] * (float) $l['price']) : 0.0;
            $t = self::round2($s * $rate / 100);
            $per[$l['line_number']] = $s;
            $subtotal += $s;
            $tax += $t;
        }
        $subtotal = self::round2($subtotal);
        $tax = self::round2($tax);
        $total = self::round2($subtotal + $tax);
        // DECIMAL(20,6): 14 integer digits. An amount that does not fit is a capture error (422), not a server failure.
        foreach ($per as $n => $s) {
            if ($s >= 1e14) {
                throw new InvalidArgumentException('line:' . $n);
            }
        }
        if ($total >= 1e14) {
            throw new InvalidArgumentException('lines');
        }
        return ['lines' => $per, 'subtotal' => $subtotal, 'tax' => $tax, 'total' => $total];
    }
}
