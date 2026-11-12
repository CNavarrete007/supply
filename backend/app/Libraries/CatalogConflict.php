<?php

declare(strict_types=1);

namespace App\Libraries;

use RuntimeException;

/** Catálogos · excepción de escritura (ver CatalogWriteBase). */
final class CatalogConflict extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }
}
