<?php

declare(strict_types=1);

namespace App\Libraries;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/** Validación estricta de las nuevas requisiciones; nunca interpreta registros legacy. */
final class RequisitionInput
{
    public static function payload(mixed $input): array
    {
        if (! is_array($input) || array_is_list($input)) {
            throw new InvalidArgumentException('Se requiere un objeto JSON.');
        }
        self::keys($input, ['client_id','request_date','need_date','priority','currency','client_reference',
            'project','contract','requester_name','requester_email','delivery_place','budget',
            'description','notes','items']);
        $items = $input['items'] ?? null;
        if (! is_array($items) || ! array_is_list($items) || count($items) < 1 || count($items) > 50) {
            throw new InvalidArgumentException('Se requieren de 1 a 50 partidas.');
        }
        $normalizedItems = [];
        $seen = [];
        foreach ($items as $i => $item) {
            if (! is_array($item) || array_is_list($item)) {
                throw new InvalidArgumentException('La partida no es un objeto.');
            }
            self::keys($item, ['id','description','quantity','unit','category']);
            $id = self::nullableText($item['id'] ?? null, 36);
            if ($id !== null && ! self::uuidValid($id)) {
                throw new InvalidArgumentException('ID de partida inválido.');
            }
            if ($id !== null && isset($seen[$id])) {
                throw new InvalidArgumentException('ID de partida duplicado.');
            }
            if ($id !== null) {
                $seen[$id] = true;
            }
            $normalizedItems[] = [
                'id' => $id,
                'description' => self::requiredText($item['description'] ?? null, 2000, 3),
                'quantity' => self::decimal($item['quantity'] ?? null, false),
                'unit' => self::requiredText($item['unit'] ?? null, 128),
                'category' => self::nullableText($item['category'] ?? null, 255),
            ];
        }
        $client = self::requiredText($input['client_id'] ?? null, 36);
        if (! self::uuidValid($client)) {
            throw new InvalidArgumentException('Cliente inválido.');
        }
        $requestDate = self::date($input['request_date'] ?? null, false);
        $needDate = self::date($input['need_date'] ?? null, true);
        if ($needDate !== null && $needDate < $requestDate) {
            throw new InvalidArgumentException('La fecha requerida es anterior a la solicitud.');
        }
        $priority = self::requiredText($input['priority'] ?? null, 24);
        if (! in_array($priority, ['normal','high','urgent'], true)) {
            throw new InvalidArgumentException('Prioridad no permitida.');
        }
        $currency = self::requiredText($input['currency'] ?? null, 3);
        if (! preg_match('/^[A-Z]{3}$/D', $currency)) {
            throw new InvalidArgumentException('Moneda inválida.');
        }
        $email = self::nullableText($input['requester_email'] ?? null, 254);
        if ($email !== null && ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Correo del solicitante inválido.');
        }
        return [
            'client_id' => $client, 'request_date' => $requestDate, 'need_date' => $needDate,
            'priority' => $priority, 'currency' => $currency,
            'client_reference' => self::nullableText($input['client_reference'] ?? null, 255),
            'project' => self::nullableText($input['project'] ?? null, 255),
            'contract' => self::nullableText($input['contract'] ?? null, 255),
            'requester_name' => self::nullableText($input['requester_name'] ?? null, 255),
            'requester_email' => $email,
            'delivery_place' => self::nullableText($input['delivery_place'] ?? null, 4000),
            'budget' => self::decimal($input['budget'] ?? null, true),
            'description' => self::nullableText($input['description'] ?? null, 4000),
            'notes' => self::nullableText($input['notes'] ?? null, 4000),
            'items' => $normalizedItems,
        ];
    }

    private static function keys(array $value, array $allowed): void
    {
        foreach (array_keys($value) as $key) {
            if (! in_array($key, $allowed, true)) {
                throw new InvalidArgumentException('Campo no permitido: ' . $key);
            }
        }
    }

    public static function uuidValid(string $value): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/Di', $value) === 1;
    }

    private static function requiredText(mixed $input, int $max, int $min = 1): string
    {
        if (! is_string($input)) {
            throw new InvalidArgumentException('Texto requerido.');
        }
        $value = trim($input);
        $length = mb_strlen($value, 'UTF-8');
        if ($length < $min || $length > $max || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/', $value)) {
            throw new InvalidArgumentException('Texto fuera de los límites permitidos.');
        }
        return $value;
    }

    private static function nullableText(mixed $input, int $max): ?string
    {
        if ($input === null || $input === '') {
            return null;
        }
        return self::requiredText($input, $max);
    }

    public static function decimal(mixed $input, bool $nullable): ?string
    {
        if ($nullable && ($input === null || $input === '')) {
            return null;
        }
        if (! is_string($input) || ! preg_match('/^(?:0|[1-9][0-9]{0,13})(?:\.([0-9]{1,6}))?$/D', $input)) {
            throw new InvalidArgumentException('Importe o cantidad decimal inválido (máximo 6 decimales).');
        }
        $parts = explode('.', $input, 2);
        if (! $nullable && preg_match('/^0(?:\.0+)?$/D', $input)) {
            throw new InvalidArgumentException('La cantidad debe ser mayor a cero.');
        }
        return $parts[0] . (isset($parts[1]) ? '.' . $parts[1] : '');
    }

    private static function date(mixed $value, bool $nullable): ?string
    {
        if ($nullable && ($value === null || $value === '')) {
            return null;
        }
        if (! is_string($value) || ! preg_match('/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/D', $value)) {
            throw new InvalidArgumentException('Fecha inválida.');
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('UTC'));
        if ($date === false || $date->format('Y-m-d') !== $value) {
            throw new InvalidArgumentException('Fecha inválida.');
        }
        return $value;
    }
}
