<?php

declare(strict_types=1);

namespace App\Libraries;

use InvalidArgumentException;

/**
 * Usuarios y roles · gestión de acceso (25 nov 2026): validación del cuerpo y reglas de contraseña.
 * La contraseña temporal la genera el servidor (nunca el navegador) y se muestra una sola vez; la definitiva la elige el usuario.
 */
final class UserAccessInput
{
    public const ACTIONS = ['grant_master_admin', 'reset_password', 'revoke_master_admin'];
    public const MIN_LENGTH = 12;
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // sin 0/O, 1/l/I

    /** @return array{action:string,actor_password:string,reason:string} */
    public static function payload(mixed $j): array
    {
        if (! is_array($j) || array_is_list($j) || array_diff(array_keys($j), ['action', 'actor_password', 'reason']) !== []) {
            throw new InvalidArgumentException('body');
        }
        if (! in_array($j['action'] ?? null, self::ACTIONS, true)) {
            throw new InvalidArgumentException('action');
        }
        $pw = $j['actor_password'] ?? null;
        if (! is_string($pw) || $pw === '' || strlen($pw) > 1024) {
            throw new InvalidArgumentException('actor_password');
        }
        $reason = $j['reason'] ?? null;
        if (! is_string($reason) || ! preg_match('//u', $reason)) {
            throw new InvalidArgumentException('reason');
        }
        $reason = trim(preg_replace('/\s+/u', ' ', $reason) ?? '');
        $len = mb_strlen($reason);
        if ($len < 10 || $len > 500 || preg_match('/[\x00-\x1F\x7F]/', $reason)) {
            throw new InvalidArgumentException('reason');
        }
        return ['action' => $j['action'], 'actor_password' => $pw, 'reason' => $reason];
    }

    /** Why a new password is not acceptable (Spanish), or null. */
    public static function passwordProblem(string $new, string $email, ?string $current = null): ?string
    {
        if (! preg_match('//u', $new) || preg_match('/[\x00-\x1F\x7F]/', $new)) {
            return 'La contraseña contiene caracteres no permitidos.';
        }
        $len = mb_strlen($new);
        if ($len < self::MIN_LENGTH || strlen($new) > 128) {
            return 'La contraseña debe tener entre 12 y 128 caracteres.';
        }
        if (! preg_match('/\p{L}/u', $new) || ! preg_match('/\p{N}/u', $new)) {
            return 'La contraseña debe combinar letras y números.';
        }
        if (count(array_unique(preg_split('//u', $new, -1, PREG_SPLIT_NO_EMPTY))) < 5) {
            return 'La contraseña repite demasiados caracteres.';
        }
        $local = mb_strtolower((string) strstr($email, '@', true));
        if (mb_strlen($local) >= 4 && str_contains(mb_strtolower($new), $local)) {
            return 'La contraseña no puede contener tu usuario.';
        }
        if ($current !== null && hash_equals($current, $new)) {
            return 'La nueva contraseña debe ser distinta de la actual.';
        }
        return null;
    }

    /** 16 random characters in four groups (e.g. Xk7m-Pq9r-T2wz-Hb4n): letters and digits, no ambiguous characters. */
    public static function temporaryPassword(): string
    {
        do {
            $chars = '';
            for ($i = 0; $i < 16; $i++) {
                $chars .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }
        } while (! preg_match('/[A-Za-z]/', $chars) || ! preg_match('/[0-9]/', $chars));
        return implode('-', str_split($chars, 4));
    }

    public static function hash(string $password): string
    {
        // Same Argon2id parameters as the existing accounts (SupplyAuthRepository only accepts $argon2id$ hashes).
        return password_hash($password, PASSWORD_ARGON2ID, ['memory_cost' => 65536, 'time_cost' => 3, 'threads' => 1]);
    }
}
