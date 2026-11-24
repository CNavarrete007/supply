<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\CatalogReadRepository;
use App\Libraries\ClientInput;
use App\Libraries\ContractorInput;
use App\Libraries\ContractorWriteRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Contratista · PUT /api/v1/contractors/{id} (If-Match = versión de updated_at) y GET /api/v1/contractors/{id}/logo.
 * Edita SOLO los datos de la empresa de la sesión (razón social, RFC, teléfono, correo, domicilio y logotipo) con la cuenta
 * catalogwrite. No hay alta ni baja de empresas: registrar otras empresas no está habilitado.
 */
final class ContractorWriteController extends CatalogWriteController
{
    protected const ENTITY_KIND = 'organization';
    protected const INVALID_CODE = 'INVALID_CONTRACTOR';
    protected const INVALID_MESSAGE = 'Revisa los datos de la empresa.';
    protected const NOT_FOUND_MESSAGE = 'Empresa no encontrada.';
    protected const IF_MATCH_MESSAGE = 'Se necesita la versión vigente de los datos de la empresa.';
    protected const NOT_PROVISIONED_MESSAGE = 'El guardado de los datos de la empresa aún no está habilitado en este equipo (falta aprovisionar la cuenta de escritura del catálogo). No se guardaron cambios.';
    protected const UNAVAILABLE_CODE = 'CONTRACTOR_WRITE_UNAVAILABLE';
    protected const UNAVAILABLE_MESSAGE = 'No se pudieron guardar los datos de la empresa. No se confirmaron cambios parciales.';
    protected const VERSION_PATTERN = '/^"([1-9][0-9]{0,15})"$/D';

    protected function parse(mixed $json): array
    {
        return ContractorInput::payload($json);
    }

    protected function repository(): object
    {
        return new ContractorWriteRepository();
    }

    public function logo(string $id): ResponseInterface
    {
        if ($denied = $this->authorize()) {
            return $denied;
        }
        if (! ClientInput::uuidValid($id) || $this->request->getGet() !== []) {
            return $this->fail(404, 'NOT_FOUND', 'Logotipo no encontrado.');
        }
        try {
            return $this->serveLogo((new CatalogReadRepository())->organizationLogo((int) $this->actor['organization_id'], strtolower($id)));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow contractor logo unavailable.');
            return $this->fail(503, 'LOGO_UNAVAILABLE', 'No se pudo consultar el logotipo.');
        }
    }
}
