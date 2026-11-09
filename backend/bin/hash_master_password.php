<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') { exit(3); }
$value = stream_get_contents(STDIN, 2048);
if (! is_string($value)) { exit(3); }
$value = rtrim($value, "\r\n");
if (strlen($value) < 14 || strlen($value) > 128 || ! preg_match('/[A-Z]/', $value)
    || ! preg_match('/[a-z]/', $value) || ! preg_match('/[0-9]/', $value)) {
    fwrite(STDERR, "La clave debe tener 14-128 caracteres, mayuscula, minuscula y numero.\n");
    exit(2);
}
$hash = password_hash($value, PASSWORD_ARGON2ID, ['memory_cost' => 65536, 'time_cost' => 3, 'threads' => 1]);
if (! is_string($hash) || ! password_verify($value, $hash)) { exit(3); }
echo $hash, "\n";
