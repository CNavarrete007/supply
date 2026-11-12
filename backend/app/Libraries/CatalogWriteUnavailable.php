<?php

declare(strict_types=1);

namespace App\Libraries;

use RuntimeException;

/** Catálogos · excepción de escritura (ver CatalogWriteBase). */
final class CatalogWriteUnavailable extends RuntimeException {}
