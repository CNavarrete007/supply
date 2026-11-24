<?php

declare(strict_types=1);

namespace App\Libraries;

/**
 * Contratista (datos de la empresa de la sesión) · validación estricta del cuerpo JSON de la edición.
 * Solo los campos con columna en `organizations` que muestra la pantalla: razón social, RFC, teléfono, correo, domicilio y
 * logotipo. El estatus de la empresa activa no se edita aquí (desactivar la organización dueña de los datos sería peligroso).
 */
final class ContractorInput extends ClientInput
{
    private const FIELDS = ['legal_name', 'tax_id', 'phone', 'email', 'address', 'logo'];

    /** @return array{legal_name:string,tax_id:string,phone:string,email:string,address:string,logo:?array} */
    public static function payload(mixed $j): array
    {
        if (! is_array($j) || array_is_list($j) || array_diff(array_keys($j), self::FIELDS) !== []) {
            self::bad('body');
        }
        $email = self::text($j, 'email', 254);
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            self::bad('email');
        }
        $phone = self::text($j, 'phone', 80);
        if ($phone !== '' && (preg_match('/^[0-9+()\-. extEXT\/]{3,80}$/D', $phone) !== 1 || preg_match('/[0-9]/', $phone) !== 1)) {
            self::bad('phone');
        }
        return [
            'legal_name' => self::text($j, 'legal_name', 255, true),
            'tax_id' => self::text($j, 'tax_id', 64, false, '/^[\p{L}\p{N}&\-. ]{1,64}$/uD'),
            'phone' => $phone,
            'email' => $email,
            'address' => self::block($j, 'address', 4000),
            'logo' => self::logo($j['logo'] ?? null),
        ];
    }
}
