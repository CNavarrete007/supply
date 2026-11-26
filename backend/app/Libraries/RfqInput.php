<?php

declare(strict_types=1);

namespace App\Libraries;

use DateTimeImmutable;
use InvalidArgumentException;

/**
 * Cotizaciones › Solicitud a proveedores (RFQ, tarjeta 2) · validación estricta del cuerpo JSON (no confía en el frontend).
 * Mismas reglas que rfq.mjs validateRfq(): obligatorios del diseño, fecha límite no anterior a la emisión, partidas elegidas.
 * El mensaje de cada excepción es el campo. Estatus al registrar: Borrador o Enviada (la respuesta la marca la cotización).
 */
final class RfqInput
{
    /** Frontend code → [status_code, legacy_status] as in the original data (borrador/Borrador, enviada/Enviada). */
    public const STATUS = ['draft' => ['borrador', 'Borrador'], 'sent' => ['enviada', 'Enviada']];

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

    public static function payload(mixed $j): array
    {
        if (! is_array($j) || array_is_list($j)) {
            self::bad('body');
        }
        $allowed = ['requisition_id', 'supplier_id', 'contact_id', 'issue_date', 'deadline', 'required_date', 'currency', 'delivery_place', 'docs', 'conditions', 'status', 'items'];
        if (array_diff(array_keys($j), $allowed) !== []) {
            self::bad('body');
        }
        foreach (['requisition_id', 'supplier_id', 'contact_id'] as $k) {
            if (! self::uuid($j[$k] ?? null)) {
                self::bad($k);
            }
        }
        $issue = self::date($j['issue_date'] ?? null, 'issue_date', true);
        $deadline = self::date($j['deadline'] ?? null, 'deadline', true);
        if ($deadline < $issue) {
            self::bad('deadline');
        }
        $required = self::date($j['required_date'] ?? null, 'required_date', false);
        $currency = $j['currency'] ?? null;
        if (! is_string($currency) || preg_match('/^[A-Z]{3}$/D', $currency) !== 1) {
            self::bad('currency');
        }
        $status = $j['status'] ?? null;
        if (! is_string($status) || ! isset(self::STATUS[$status])) {
            self::bad('status');
        }
        $items = $j['items'] ?? null;
        if (! is_array($items) || ! array_is_list($items) || $items === [] || count($items) > 500) {
            self::bad('items');
        }
        foreach ($items as $i) {
            if (! self::uuid($i)) {
                self::bad('items');
            }
        }
        if (count(array_unique($items)) !== count($items)) {
            self::bad('items');
        }
        return [
            'requisition_id' => $j['requisition_id'], 'supplier_id' => $j['supplier_id'], 'contact_id' => $j['contact_id'],
            'issue_date' => $issue, 'deadline' => $deadline, 'required_date' => $required, 'currency' => $currency,
            'delivery_place' => self::text($j, 'delivery_place', 500), 'docs' => self::text($j, 'docs', 4000), 'conditions' => self::text($j, 'conditions', 4000),
            'status' => $status, 'items' => array_values($items),
        ];
    }
}
