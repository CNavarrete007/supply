<?php

declare(strict_types=1);

namespace App\Libraries;

use InvalidArgumentException;

/**
 * Catálogo de categorías · validación estricta del cuerpo JSON (alta y edición). Solo se aceptan name, description y status;
 * cualquier otra clave, tipo o longitud fuera de rango es 422 con el nombre del campo.
 */
final class CategoryInput
{
    public const NAME_MAX = 255;          // categories.name VARCHAR(255)
    public const DESCRIPTION_MAX = 16000; // categories.description TEXT (utf8mb4: 65,535 bytes)
    public const STATUSES = ['active', 'inactive'];

    /** @return array{name:string,description:?string,status:string} */
    public static function payload(mixed $json): array
    {
        if (! is_array($json) || array_is_list($json) && $json !== []) {
            throw new InvalidArgumentException('body');
        }
        foreach (array_keys($json) as $k) {
            if (! in_array($k, ['name', 'description', 'status'], true)) {
                throw new InvalidArgumentException((string) $k);
            }
        }
        $name = $json['name'] ?? null;
        if (! is_string($name)) {
            throw new InvalidArgumentException('name');
        }
        $name = trim((string) preg_replace('/\s+/u', ' ', $name));
        if ($name === '' || mb_strlen($name, 'UTF-8') > self::NAME_MAX || preg_match('/[\x00-\x1F\x7F]/u', $name) || ! mb_check_encoding($name, 'UTF-8')) {
            throw new InvalidArgumentException('name');
        }
        $description = $json['description'] ?? '';
        if ($description !== null && ! is_string($description)) {
            throw new InvalidArgumentException('description');
        }
        $description = trim((string) $description);
        if (mb_strlen($description, 'UTF-8') > self::DESCRIPTION_MAX || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $description) || ! mb_check_encoding($description, 'UTF-8')) {
            throw new InvalidArgumentException('description');
        }
        $status = $json['status'] ?? 'active';
        if (! is_string($status) || ! in_array($status, self::STATUSES, true)) {
            throw new InvalidArgumentException('status');
        }
        return ['name' => $name, 'description' => $description === '' ? null : $description, 'status' => $status];
    }

    /** Código de una categoría (ruta): el formato del catálogo importado ("cat_…") u otro código ASCII seguro. */
    public static function codeValid(string $code): bool
    {
        return preg_match('/^[A-Za-z0-9][A-Za-z0-9_.\-]{0,63}$/D', $code) === 1;
    }
}
