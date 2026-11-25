<?php

declare(strict_types=1);
namespace App\Libraries;

use DateTimeImmutable;
use InvalidArgumentException;

/**
 * Requisición › Crear desde historial · contrato del cuerpo de POST /api/v1/recovery/requisitions/from-history.
 * Los datos generales y la forma de cada partida se validan con EXACTAMENTE las reglas de RF1 (RequisitionRecoveryInput);
 * aquí solo se agregan el origen de la partida y su tratamiento comercial/abastecimiento. El servidor no confía en el precio,
 * costo ni proveedor del navegador: cada partida del historial se resuelve contra el catálogo aprobado del cliente
 * (resolve()) y se rechaza si la cotización de referencia cambió o si la ruta elegida no está permitida.
 *
 * Interpretación (sin fuente del Apps Script; ningún expediente de recompra existe en la base): rutas de precio
 * fixed/requote/validate y de proveedor reuse/validate/requote; las partidas nuevas siempre se recotizan.
 */
final class RequisitionHistoryInput
{
    public const PRICE_MODES = ['fixed', 'requote', 'validate'];
    public const SOURCING_MODES = ['reuse', 'validate', 'requote'];
    public const SOURCE_TYPE = 'Historial del cliente (recompra)';
    public const HISTORY_ORIGIN = 'approved_customer_quote';
    public const NEW_ORIGIN = 'new_line';

    private static function keys(array $value, array $allowed): void
    {
        foreach (array_keys($value) as $key) {
            if (! in_array($key, $allowed, true)) {
                throw new InvalidArgumentException('Campo no admitido: ' . $key);
            }
        }
    }

    /** @return array{general:array<string,mixed>,lines:list<array<string,mixed>>} */
    public static function payload(mixed $v): array
    {
        if (! is_array($v) || array_is_list($v)) {
            throw new InvalidArgumentException('Se requiere una requisición.');
        }
        self::keys($v, ['client_id', 'request_date', 'need_date', 'project', 'contract', 'client_reference', 'priority', 'delivery_place',
            'requester_name', 'requester_email', 'budget', 'currency', 'description', 'notes', 'items']);
        $items = $v['items'] ?? null;
        if (! is_array($items) || ! array_is_list($items) || count($items) < 1 || count($items) > 1000) {
            throw new InvalidArgumentException('Agrega al menos una partida desde el historial o captura una nueva. Límite técnico: 1000.');
        }
        $rf1Items = [];
        $routes = [];
        $seen = [];
        foreach ($items as $n => $item) {
            if (! is_array($item) || array_is_list($item)) {
                throw new InvalidArgumentException('Partida inválida.');
            }
            $origin = $item['origin'] ?? null;
            $label = 'Partida ' . ($n + 1);
            if ($origin === 'history') {
                self::keys($item, ['origin', 'article_key', 'quote_version_id', 'quantity', 'price_mode', 'sourcing_mode']);
                $key = $item['article_key'] ?? null;
                $version = $item['quote_version_id'] ?? null;
                if (! is_string($key) || preg_match('/^[a-f0-9]{16}$/D', $key) !== 1 || ! is_string($version) || ! RequisitionRecoveryInput::uuid($version)) {
                    throw new InvalidArgumentException($label . ': referencia del historial inválida.');
                }
                if (isset($seen[$key])) {
                    throw new InvalidArgumentException($label . ': el artículo del historial ya está en la requisición.');
                }
                $seen[$key] = true;
                if (! in_array($item['price_mode'] ?? null, self::PRICE_MODES, true) || ! in_array($item['sourcing_mode'] ?? null, self::SOURCING_MODES, true)) {
                    throw new InvalidArgumentException($label . ': tratamiento de precio o de proveedor no válido.');
                }
                // Description/unit/category come from the approved history (resolve()); placeholders keep the RF1 shape check.
                $rf1Items[] = ['description' => 'historial', 'quantity' => $item['quantity'] ?? null, 'unit' => 'historial', 'category' => 'historial'];
                $routes[] = ['origin' => 'history', 'article_key' => $key, 'quote_version_id' => strtolower($version), 'price_mode' => $item['price_mode'], 'sourcing_mode' => $item['sourcing_mode']];
            } elseif ($origin === 'new') {
                self::keys($item, ['origin', 'description', 'quantity', 'unit', 'category', 'price_mode', 'sourcing_mode']);
                if (($item['price_mode'] ?? 'requote') !== 'requote' || ($item['sourcing_mode'] ?? 'requote') !== 'requote') {
                    throw new InvalidArgumentException($label . ': las partidas nuevas requieren nuevo precio comercial y cotización de proveedor.');
                }
                $rf1Items[] = ['description' => $item['description'] ?? null, 'quantity' => $item['quantity'] ?? null, 'unit' => $item['unit'] ?? null, 'category' => $item['category'] ?? null];
                $routes[] = ['origin' => 'new', 'price_mode' => 'requote', 'sourcing_mode' => 'requote'];
            } else {
                throw new InvalidArgumentException($label . ': origen no válido.');
            }
        }
        // Same general-data and line-shape rules as Registro de requisición (RF1). The folio is assigned by the server.
        $rf1 = $v;
        unset($rf1['items']);
        $rf1['folio'] = 'AUTO';
        $rf1['items'] = $rf1Items;
        $rf1['source'] = ['type' => RequisitionRecoveryInput::FORMAL, 'date' => $v['request_date'] ?? null];
        $general = RequisitionRecoveryInput::payload($rf1);
        if ($general['need_date'] < $general['request_date']) {
            throw new InvalidArgumentException('La fecha requerida no puede ser anterior a la fecha de solicitud.');
        }
        $lines = [];
        foreach ($general['items'] as $i => $line) {
            $lines[] = $routes[$i] + ['quantity' => $line['quantity'], 'description' => $line['description'], 'unit' => $line['unit'], 'category' => $line['category']];
        }
        unset($general['items'], $general['folio'], $general['source'], $general['document']);
        $general['client_id'] = strtolower($general['client_id']);
        return ['general' => $general, 'lines' => $lines];
    }

    /** Validity of a historical price under the client policy (same rule as historyModel.mjs validity()). */
    public static function validity(?array $last, ?array $policy, string $today): string
    {
        $days = $policy['price_validity_days'] ?? null;
        $date = isset($last['quote_date']) && $last['quote_date'] !== null ? substr((string) $last['quote_date'], 0, 10) : '';
        if ($days === null || $date === '' || preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date) !== 1) {
            return 'undefined';
        }
        if ((int) $days === 0) {
            return 'valid';
        }
        $until = (new DateTimeImmutable($date . ' 00:00:00'))->modify('+' . (int) $days . ' days')->format('Y-m-d');
        return $until >= $today ? 'valid' : 'expired';
    }

    /** Why a route is not allowed (same rule as historyModel.mjs modeBlock()); null = allowed. */
    public static function modeBlock(array $line, string $kind, ?array $last, ?array $policy, string $today): ?string
    {
        $mode = $kind === 'price' ? $line['price_mode'] : $line['sourcing_mode'];
        if ($line['origin'] === 'new') {
            return $mode === 'requote' ? null : 'Las partidas nuevas requieren nuevo precio comercial y cotización de proveedor.';
        }
        $state = self::validity($last, $policy, $today);
        if ($kind === 'price') {
            if ($mode === 'fixed' && ! ((float) ($last['unit_price'] ?? 0) > 0)) {
                return 'Sin precio histórico al cliente.';
            }
            if ($mode === 'fixed' && $state === 'expired') {
                return 'Precio histórico vencido según la vigencia de la política del cliente.';
            }
            return null;
        }
        if ($mode !== 'requote' && trim((string) ($last['supplier'] ?? '')) === '') {
            return 'Sin proveedor adjudicado en el historial.';
        }
        if ($mode === 'reuse' && ! ((float) ($last['cost'] ?? 0) > 0)) {
            return 'Sin costo histórico registrado.';
        }
        if ($mode === 'reuse' && $state === 'expired') {
            return 'Costo histórico vencido según la vigencia de la política del cliente.';
        }
        return null;
    }

    /**
     * Resolves every history line against the client's APPROVED catalog (RequisitionHistoryReadRepository::catalog()).
     * The description, brand/model, unit, category, price, cost and supplier come from the server, never from the browser.
     * @return list<array<string,mixed>>
     */
    public static function resolve(array $lines, array $catalog, string $today): array
    {
        $byKey = [];
        foreach ($catalog['items'] ?? [] as $a) {
            $byKey[$a['key']] = $a;
        }
        $policy = $catalog['client']['policy'] ?? null;
        $out = [];
        foreach ($lines as $n => $line) {
            $label = 'Partida ' . ($n + 1);
            $last = null;
            if ($line['origin'] === 'history') {
                $a = $byKey[$line['article_key']] ?? null;
                $last = $a['last'] ?? null;
                if (! $a || ! $last || ($last['quote_version_id'] ?? null) !== $line['quote_version_id']) {
                    throw new RecoveryConflict('HISTORY_CHANGED', $label . ': el historial del cliente cambió desde que se consultó. Se recargó el catálogo; revisa la partida.');
                }
                $desc = trim((string) $a['description']);
                if (! empty($a['brand_model'])) {
                    $desc .= "\nMarca / modelo: " . trim((string) $a['brand_model']);
                }
                if (trim((string) ($a['unit'] ?? '')) === '' || trim((string) ($a['category'] ?? '')) === '') {
                    throw new RecoveryConflict('HISTORY_INCOMPLETE', $label . ': el artículo del historial no tiene unidad o categoría; captúralo como partida nueva.');
                }
                $line['description'] = $desc;
                $line['unit'] = trim((string) $a['unit']);
                $line['category'] = trim((string) $a['category']);
                $line['validity'] = self::validity($last, $policy, $today);
                $line['last'] = $last;
                $line['brand_model'] = $a['brand_model'] ?? null;
            }
            foreach (['price', 'sourcing'] as $kind) {
                if ($why = self::modeBlock($line, $kind, $last, $policy, $today)) {
                    throw new RecoveryConflict('ROUTE_NOT_ALLOWED', $label . ': ' . $why);
                }
            }
            $out[] = $line;
        }
        return $out;
    }
}
