<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ClientInput;
use App\Libraries\ClientWriteRepository;

/**
 * Catálogo de clientes · POST /api/v1/catalogs/clients, PUT /api/v1/catalogs/clients/{id} (If-Match) y
 * GET /api/v1/catalogs/clients/{id}/logo. El portal del cliente no se administra aquí.
 */
final class ClientWriteController extends CatalogWriteController
{
    protected const ENTITY_KIND = 'client';
    protected const LOGO_ROLE = 'clientLogo';
    protected const INVALID_CODE = 'INVALID_CLIENT';
    protected const INVALID_MESSAGE = 'Revisa los datos del cliente.';
    protected const NOT_FOUND_MESSAGE = 'Cliente no encontrado.';
    protected const IF_MATCH_MESSAGE = 'Se necesita la versión vigente del cliente.';
    protected const NOT_PROVISIONED_MESSAGE = 'El guardado de clientes aún no está habilitado en este equipo (falta aprovisionar la cuenta de escritura del catálogo). No se guardaron cambios.';
    protected const UNAVAILABLE_CODE = 'CLIENT_WRITE_UNAVAILABLE';
    protected const UNAVAILABLE_MESSAGE = 'No se pudo guardar el cliente. No se confirmaron cambios parciales.';

    protected function parse(mixed $json): array
    {
        return ClientInput::payload($json);
    }

    protected function repository(): object
    {
        return new ClientWriteRepository();
    }
}
