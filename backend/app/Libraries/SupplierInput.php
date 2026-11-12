<?php

declare(strict_types=1);

namespace App\Libraries;

/**
 * Catálogo de proveedores · validación estricta del cuerpo JSON de alta/actualización (reglas comunes en ClientInput).
 * Estatus, crédito y unidad aceptan el catálogo del diseño o el valor ya guardado (el repositorio lo verifica).
 */
final class SupplierInput extends ClientInput
{
    public const STATUSES = ['under_evaluation', 'authorized', 'suspended', 'inactive'];
    public const CURRENCIES = ['MXN', 'USD', 'EUR'];
    public const CREDIT_TYPES = ['Contado', 'Anticipo', 'Crédito', 'Contra entrega', 'Parcialidades', 'Consignación', 'Otro'];
    public const LEAD_UNITS = ['días hábiles', 'días naturales', 'semanas', 'meses'];
    private const FIELDS = ['code', 'name', 'tax_id', 'supplier_key', 'contacts', 'emails', 'phones', 'category', 'status', 'currency',
        'credit_type', 'credit_days', 'lead_time_value', 'lead_time_unit', 'rating', 'document_notes', 'notes', 'logo'];

    /** @return array<string,mixed> */
    public static function payload(mixed $j): array
    {
        if (! is_array($j) || array_is_list($j) || array_diff(array_keys($j), self::FIELDS) !== []) {
            self::bad('body');
        }
        $code = static function (string $k, int $max = 64) use ($j): string {
            $v = $j[$k] ?? '';
            if (! is_string($v) || mb_strlen($v) > $max || preg_match('/[\x00-\x1F\x7F]/u', $v) === 1) {
                self::bad($k);
            }
            return trim($v);
        };
        $currency = $code('currency', 3);
        if ($currency !== '' && ! in_array($currency, self::CURRENCIES, true)) {
            self::bad('currency');
        }
        $int = static function (string $k, int $max) use ($j): ?int {
            $v = $j[$k] ?? null;
            if ($v === null || $v === '') {
                return null;
            }
            if (! is_int($v) || $v < 0 || $v > $max) {
                self::bad($k);
            }
            return $v;
        };
        $num = static function (string $k, float $max) use ($j): ?string {
            $v = $j[$k] ?? null;
            if ($v === null || $v === '') {
                return null;
            }
            if ((! is_int($v) && ! is_float($v)) || $v < 0 || $v > $max) {
                self::bad($k);
            }
            return number_format(round((float) $v, 4), 4, '.', '');
        };
        return [
            'code' => self::text($j, 'code', 80, true, '/^[\p{L}\p{N}][\p{L}\p{N}._\-\/ ]{0,79}$/uD'),
            'name' => self::text($j, 'name', 255, true),
            'tax_id' => self::text($j, 'tax_id', 64, false, '/^[\p{L}\p{N}&\-. ]{1,64}$/uD'),
            'supplier_key' => self::text($j, 'supplier_key', 255),
            'contacts' => self::list($j, 'contacts', 20, 255, static fn () => true),
            'emails' => self::list($j, 'emails', 20, 254, static fn ($e) => filter_var($e, FILTER_VALIDATE_EMAIL) !== false),
            'phones' => self::list($j, 'phones', 10, 40, static fn ($p) => preg_match('/^[0-9+()\-. extEXT]{3,40}$/D', $p) === 1 && preg_match('/[0-9]/', $p) === 1),
            'category' => self::text($j, 'category', 255, true),
            'status' => $code('status', 32) ?: 'under_evaluation',
            'currency' => $currency,
            'credit_type' => $code('credit_type'),
            'credit_days' => $int('credit_days', 3650),
            'lead_time_value' => $num('lead_time_value', 9999),
            'lead_time_unit' => $code('lead_time_unit'),
            'rating' => $num('rating', 100),
            'document_notes' => self::block($j, 'document_notes', 4000),
            'notes' => self::block($j, 'notes', 4000),
            'logo' => self::logo($j['logo'] ?? null),
        ];
    }
}
