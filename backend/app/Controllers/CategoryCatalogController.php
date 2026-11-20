<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\CategoryReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Requisición › Catálogo de categorías · read-only (Master Admin, cuenta API de solo SELECT).
 * GET api/v1/catalogs/categories → categorías con estatus y uso (partidas, requisiciones, proveedores y suministros).
 * Alta, edición, cambio de estatus y eliminación NO están expuestos: ninguna cuenta SQL tiene permiso de escritura
 * sobre `categories` y habilitarlo requiere autorización explícita.
 */
final class CategoryCatalogController extends ReadOnlyModuleController
{
    public function index(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->query([], false) === null) {
                return $this->fail(422, 'INVALID_FILTER', 'Este recurso no acepta parámetros.');
            }
            return $this->respond(200, (new CategoryReadRepository())->catalog((int) $this->actor['organization_id']));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow category catalog unavailable.');
            return $this->fail(503, 'CATEGORIES_UNAVAILABLE', 'No se pudo consultar el catálogo de categorías.');
        }
    }
}
