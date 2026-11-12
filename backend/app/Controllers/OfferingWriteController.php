<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\OfferingInput;
use App\Libraries\OfferingWriteRepository;

/**
 * Suministros de proveedores · POST /api/v1/catalogs/supplier-offerings y PUT /api/v1/catalogs/supplier-offerings/{id}
 * (If-Match con la versión basada en updated_at). Sin logotipo y sin precios (ver CatalogWriteController).
 */
final class OfferingWriteController extends CatalogWriteController
{
    protected const ENTITY_KIND = 'supplier_offering';
    protected const INVALID_CODE = 'INVALID_OFFERING';
    protected const INVALID_MESSAGE = 'Revisa los datos del suministro.';
    protected const NOT_FOUND_MESSAGE = 'Suministro no encontrado.';
    protected const IF_MATCH_MESSAGE = 'Se necesita la versión vigente del suministro.';
    protected const NOT_PROVISIONED_MESSAGE = 'El guardado de suministros aún no está habilitado en este equipo (falta aprovisionar la cuenta de escritura del catálogo). No se guardaron cambios.';
    protected const UNAVAILABLE_CODE = 'OFFERING_WRITE_UNAVAILABLE';
    protected const UNAVAILABLE_MESSAGE = 'No se pudo guardar el suministro. No se confirmaron cambios parciales.';
    protected const VERSION_PATTERN = '/^"([1-9][0-9]{0,15})"$/D';

    protected function parse(mixed $json): array
    {
        return OfferingInput::payload($json);
    }

    protected function repository(): object
    {
        return new OfferingWriteRepository();
    }
}
