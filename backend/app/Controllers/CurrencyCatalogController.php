<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\CatalogReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * GET /api/v1/catalogs/currencies · monedas dadas de alta en ESTA base (Master Admin, solo lectura, cuenta API de SELECT).
 * Las pantallas que guardan una moneda (Proveedores, Suministros, Registro de requisición) ofrecen solo las activas: así no se
 * elige una moneda que la llave foránea de MariaDB rechazaría (p. ej. EUR en una base que solo tiene MXN y USD).
 */
final class CurrencyCatalogController extends ReadOnlyModuleController
{
    public function index(): ResponseInterface
    {
        if ($denied = $this->guard()) {
            return $denied;
        }
        if ($this->query([], false) === null) {
            return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
        }
        try {
            return $this->respond(200, ['items' => (new CatalogReadRepository())->currencies(), 'read_only' => true]);
        } catch (Throwable) {
            log_message('error', 'SupplyFlow currency catalog unavailable.');
            return $this->fail(503, 'CURRENCIES_UNAVAILABLE', 'No se pudo consultar el catálogo de monedas.');
        }
    }
}
