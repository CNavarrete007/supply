<?php

declare(strict_types=1);

namespace App\Libraries;

use DateTimeImmutable;
use InvalidArgumentException;

/**
 * Gestión del Contratista · validación estricta de los cuerpos JSON de escritura (no confía en el frontend).
 * Mismas reglas que validationForm.mjs (tarjeta 1) y strategyModel.mjs (tarjeta 2). El mensaje de cada excepción es el campo.
 */
final class ContractorMgmtInput
{
    public const RESULTS = ['Pendiente', 'Conforme', 'Con observaciones', 'No conforme'];
    public const BUDGETS = ['Pendiente', 'Disponible', 'Parcial', 'No disponible'];
    public const STRATEGIES = ['Competencia abierta', 'Proveedor preferente', 'Compra urgente', 'Fuente única justificada'];
    public const ITEM_STRATEGIES = ['Competencia abierta', 'Proveedor preferente', 'Fuente única justificada', 'Precio histórico auto', 'Compra urgente'];
    public const NO_RFQ = 'Precio histórico auto';

    private static function bad(string $field): never
    {
        throw new InvalidArgumentException($field);
    }

    public static function uuid(mixed $v): bool
    {
        return is_string($v) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D', $v) === 1;
    }

    private static function keys(array $v, array $allowed, string $field = 'body'): void
    {
        if (array_is_list($v) && $v !== [] || array_diff(array_keys($v), $allowed) !== []) {
            self::bad($field);
        }
    }

    private static function text(array $j, string $k, int $max, bool $required = false): string
    {
        $v = $j[$k] ?? '';
        if (! is_string($v) || preg_match('//u', $v) !== 1 || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $v) === 1) {
            self::bad($k);
        }
        $v = trim(str_replace("\r\n", "\n", $v));
        if (($required && $v === '') || mb_strlen($v) > $max) {
            self::bad($k);
        }
        return $v;
    }

    private static function count(mixed $v, string $field): int
    {
        if (is_int($v)) {
            $n = $v;
        } elseif (is_string($v) && preg_match('/^\d{1,2}$/D', trim($v)) === 1) {
            $n = (int) trim($v);
        } else {
            self::bad($field);
        }
        if ($n < 1 || $n > 20) {
            self::bad($field);
        }
        return $n;
    }

    private static function oneOf(array $j, string $k, array $list): string
    {
        $v = $j[$k] ?? null;
        if (! is_string($v) || ! in_array($v, $list, true)) {
            self::bad($k);
        }
        return $v;
    }

    /** Card 1 "Guardar validación" / "Guardar cambios". $edit: the requisition is fixed (not sent). */
    public static function review(mixed $j, string $today, bool $edit = false, ?string $keepDeadline = null): array
    {
        if (! is_array($j) || array_is_list($j)) {
            self::bad('body');
        }
        self::keys($j, ['requisition_id', 'buyer_id', 'technical', 'contract', 'budget', 'strategy', 'min_quotes', 'deadline', 'criteria', 'notes']);
        $req = $j['requisition_id'] ?? null;
        if (! $edit && ! self::uuid($req)) {
            self::bad('requisition_id');
        }
        if (! self::uuid($j['buyer_id'] ?? null)) {
            self::bad('buyer_id');
        }
        $out = [
            'requisition_id' => $edit ? null : $req,
            'buyer_id' => $j['buyer_id'],
            'technical' => self::oneOf($j, 'technical', self::RESULTS),
            'contract' => self::oneOf($j, 'contract', self::RESULTS),
            'budget' => self::oneOf($j, 'budget', self::BUDGETS),
            'strategy' => self::oneOf($j, 'strategy', self::STRATEGIES),
            'min_quotes' => self::count($j['min_quotes'] ?? null, 'min_quotes'),
            'deadline' => null,
            'criteria' => self::text($j, 'criteria', 1000, true),
            'notes' => self::text($j, 'notes', 2000),
        ];
        $d = $j['deadline'] ?? '';
        if ($d !== '' && $d !== null) {
            if (! is_string($d) || preg_match('/^\d{4}-\d{2}-\d{2}$/D', $d) !== 1 || ($x = DateTimeImmutable::createFromFormat('!Y-m-d', $d)) === false || $x->format('Y-m-d') !== $d) {
                self::bad('deadline');
            }
            // Same rule as the form: not before today, except an unchanged deadline when editing.
            if ($d < $today && ! ($edit && $d === $keepDeadline)) {
                self::bad('deadline');
            }
            $out['deadline'] = $d;
        }
        $needsWhy = $out['strategy'] === 'Fuente única justificada' || $out['technical'] === 'No conforme' || $out['contract'] === 'No conforme' || $out['budget'] === 'No disponible';
        if ($needsWhy && mb_strlen($out['notes']) < 10) {
            self::bad('notes');
        }
        return $out;
    }

    /** "Puede pasar a cotización" rule of Reglas inteligentes (Spanish values as stored by the form). */
    public static function canQuote(string $technical, string $contract, string $budget): bool
    {
        $ok = static fn (string $x) => in_array(mb_strtolower(trim($x)), ['conforme', 'con observaciones', 'compliant', 'with observations'], true);
        return $ok($technical) && $ok($contract) && in_array(mb_strtolower(trim($budget)), ['disponible', 'parcial', 'available', 'partial'], true);
    }

    private static function fold(string $v): string
    {
        $v = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $v) ?? ''), 'UTF-8');
        return strtr($v, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
    }

    /**
     * Card 2 "Guardar estrategia": { min_quotes, items:[{id, strategy, lot}], lots:[{key, name, min_quotes, suppliers:[{id, selected, suggested}]}] }.
     * Lots without lines are ignored (as in the form). Lines with "Precio histórico auto" go without lot.
     */
    public static function strategy(mixed $j): array
    {
        if (! is_array($j) || array_is_list($j)) {
            self::bad('body');
        }
        self::keys($j, ['min_quotes', 'items', 'lots']);
        $min = self::count($j['min_quotes'] ?? null, 'min_quotes');
        $items = $j['items'] ?? null;
        $lots = $j['lots'] ?? [];
        if (! is_array($items) || ! array_is_list($items) || $items === [] || count($items) > 500 || ! is_array($lots) || ! array_is_list($lots) || count($lots) > 100) {
            self::bad('items');
        }
        $byKey = [];
        foreach ($lots as $l) {
            if (! is_array($l) || array_is_list($l)) {
                self::bad('lots');
            }
            self::keys($l, ['key', 'name', 'min_quotes', 'suppliers'], 'lots');
            $key = $l['key'] ?? null;
            if (! is_string($key) || preg_match('/^[A-Za-z0-9_-]{1,20}$/D', $key) !== 1 || isset($byKey[$key])) {
                self::bad('lots');
            }
            $sup = $l['suppliers'] ?? [];
            if (! is_array($sup) || ! array_is_list($sup) || count($sup) > 200) {
                self::bad('lots');
            }
            $suppliers = [];
            foreach ($sup as $s) {
                if (! is_array($s) || array_is_list($s)) {
                    self::bad('lots');
                }
                self::keys($s, ['id', 'selected', 'suggested'], 'lots');
                if (! self::uuid($s['id'] ?? null) || ! is_bool($s['selected'] ?? null) || ! is_bool($s['suggested'] ?? null) || isset($suppliers[$s['id']])) {
                    self::bad('lots');
                }
                if ($s['selected'] || $s['suggested']) {
                    $suppliers[$s['id']] = ['id' => $s['id'], 'selected' => $s['selected'], 'suggested' => $s['suggested']];
                }
            }
            $byKey[$key] = ['key' => $key, 'name' => is_string($l['name'] ?? null) ? trim(preg_replace('/\s+/u', ' ', $l['name']) ?? '') : null,
                'min_quotes' => $l['min_quotes'] ?? null, 'suppliers' => array_values($suppliers), 'items' => []];
        }
        $seen = [];
        $lines = [];
        foreach ($items as $i) {
            if (! is_array($i) || array_is_list($i)) {
                self::bad('items');
            }
            self::keys($i, ['id', 'strategy', 'lot'], 'items');
            if (! self::uuid($i['id'] ?? null) || isset($seen[$i['id']]) || ! is_string($i['strategy'] ?? null) || ! in_array($i['strategy'], self::ITEM_STRATEGIES, true)) {
                self::bad('items');
            }
            $seen[$i['id']] = true;
            $lot = $i['lot'] ?? '';
            if ($i['strategy'] === self::NO_RFQ) {
                $lot = '';
            } elseif (! is_string($lot) || ! isset($byKey[$lot])) {
                self::bad('items');
            }
            if ($lot !== '') {
                $byKey[$lot]['items'][] = $i['id'];
            }
            $lines[] = ['id' => $i['id'], 'strategy' => $i['strategy'], 'lot' => $lot];
        }
        $names = [];
        $out = [];
        foreach ($byKey as $l) {
            if ($l['items'] === []) {
                continue; // a lot without lines is not considered
            }
            if ($l['name'] === null || $l['name'] === '' || mb_strlen($l['name']) > 255 || preg_match('/[\x00-\x1F\x7F]/', $l['name']) === 1 || isset($names[self::fold($l['name'])])) {
                self::bad('lots');
            }
            $names[self::fold($l['name'])] = true;
            $l['min_quotes'] = self::count($l['min_quotes'], 'lots');
            if (! array_filter($l['suppliers'], static fn ($s) => $s['selected'])) {
                self::bad('lots');
            }
            $out[] = $l;
        }
        return ['min_quotes' => $min, 'items' => $lines, 'lots' => $out];
    }
}
