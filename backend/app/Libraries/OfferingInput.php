<?php

declare(strict_types=1);

namespace App\Libraries;

use DateTimeImmutable;

/**
 * Suministros de proveedores · validación estricta del cuerpo JSON (reglas comunes en ClientInput). Catálogo SIN precios:
 * cualquier campo de precio se rechaza (los precios solo existen en la cotización formal).
 */
final class OfferingInput extends ClientInput
{
    public const TYPES = ['product', 'service', 'rent', 'consumable', 'spare_part', 'equipment', 'storage', 'tool'];
    public const STATUSES = ['active', 'inactive', 'unavailable'];
    public const CURRENCIES = ['MXN', 'USD', 'EUR'];
    public const CREDIT_TYPES = ['Contado', 'Anticipo', 'Crédito', 'Contra entrega', 'Parcialidades', 'Consignación', 'Otros'];
    public const LEAD_UNITS = ['días hábiles', 'días naturales', 'semanas', 'meses'];
    private const FIELDS = ['supplier_id', 'name', 'type', 'category', 'brand', 'model', 'description', 'lead_time_value', 'lead_time_unit',
        'credit_type', 'credit_days', 'currency', 'minimum_order', 'valid_until', 'coverage', 'status', 'notes'];

    /** @return array<string,mixed> */
    public static function payload(mixed $j): array
    {
        if (! is_array($j) || array_is_list($j) || array_diff(array_keys($j), self::FIELDS) !== []) {
            self::bad('body');
        }
        $supplier = $j['supplier_id'] ?? '';
        if (! is_string($supplier) || ! self::uuidValid($supplier)) {
            self::bad('supplier_id');
        }
        $short = static function (string $k, int $max = 64) use ($j): string {
            $v = $j[$k] ?? '';
            if (! is_string($v) || mb_strlen($v) > $max || preg_match('/[\x00-\x1F\x7F]/u', $v) === 1) {
                self::bad($k);
            }
            return trim($v);
        };
        $currency = $short('currency', 3);
        if ($currency !== '' && ! in_array($currency, self::CURRENCIES, true)) {
            self::bad('currency');
        }
        $days = $j['credit_days'] ?? null;
        if ($days === '') {
            $days = null;
        }
        if ($days !== null && (! is_int($days) || $days < 0 || $days > 3650)) {
            self::bad('credit_days');
        }
        $lead = $j['lead_time_value'] ?? null;
        if ($lead === '') {
            $lead = null;
        }
        if ($lead !== null && ((! is_int($lead) && ! is_float($lead)) || $lead < 0 || $lead > 9999)) {
            self::bad('lead_time_value');
        }
        $until = $j['valid_until'] ?? null;
        if ($until === '') {
            $until = null;
        }
        if ($until !== null) {
            $d = is_string($until) ? DateTimeImmutable::createFromFormat('!Y-m-d', $until) : false;
            if (! $d || $d->format('Y-m-d') !== $until || $until < '2000-01-01' || $until > '2100-12-31') {
                self::bad('valid_until');
            }
        }
        $status = $short('status', 32);
        return [
            'supplier_id' => strtolower($supplier),
            'name' => self::text($j, 'name', 500, true),
            'type' => $short('type'),
            'category' => self::text($j, 'category', 255),
            'brand' => self::text($j, 'brand', 255),
            'model' => self::text($j, 'model', 255),
            'description' => self::block($j, 'description', 4000),
            'lead_time_value' => $lead === null ? null : number_format(round((float) $lead, 4), 4, '.', ''),
            'lead_time_unit' => $short('lead_time_unit'),
            'credit_type' => $short('credit_type'),
            'credit_days' => $days,
            'currency' => $currency,
            'minimum_order' => self::text($j, 'minimum_order', 255),
            'valid_until' => $until,
            'coverage' => self::block($j, 'coverage', 2000),
            'status' => $status !== '' ? $status : 'active',
            'notes' => self::block($j, 'notes', 4000),
        ];
    }
}
