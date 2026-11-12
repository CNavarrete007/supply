<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\SupplierInput;
use App\Libraries\SupplierWriteRepository;

/**
 * Catálogo de proveedores · POST /api/v1/catalogs/suppliers, PUT /api/v1/catalogs/suppliers/{id} (If-Match) y
 * GET /api/v1/catalogs/suppliers/{id}/logo (ver CatalogWriteController).
 */
final class SupplierWriteController extends CatalogWriteController
{
    protected const ENTITY_KIND = 'supplier';
    protected const LOGO_ROLE = 'supplierLogo';
    protected const INVALID_CODE = 'INVALID_SUPPLIER';
    protected const INVALID_MESSAGE = 'Revisa los datos del proveedor.';
    protected const NOT_FOUND_MESSAGE = 'Proveedor no encontrado.';
    protected const IF_MATCH_MESSAGE = 'Se necesita la versión vigente del proveedor.';
    protected const NOT_PROVISIONED_MESSAGE = 'El guardado de proveedores aún no está habilitado en este equipo (falta aprovisionar la cuenta de escritura del catálogo). No se guardaron cambios.';
    protected const UNAVAILABLE_CODE = 'SUPPLIER_WRITE_UNAVAILABLE';
    protected const UNAVAILABLE_MESSAGE = 'No se pudo guardar el proveedor. No se confirmaron cambios parciales.';

    protected function parse(mixed $json): array
    {
        return SupplierInput::payload($json);
    }

    protected function repository(): object
    {
        return new SupplierWriteRepository();
    }
}
