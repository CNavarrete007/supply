<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ContractorManagementReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Gestión del Contratista · read-only (Master Admin). Card 1 "Registro de validación": requisitions to validate,
 * purchasing managers and the context of a requisition with its registered validations. Registering, editing or deleting
 * internal validations is NOT exposed (no write routes).
 */
final class ContractorManagementController extends ReadOnlyModuleController
{
    public function validationSetup(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== []) {
                return $this->fail(422, 'INVALID_FILTER', 'Este recurso no acepta parámetros.');
            }
            return $this->respond(200, (new ContractorManagementReadRepository())->setup((int) $this->actor['organization_id']));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow contractor management setup unavailable.');
            return $this->fail(503, 'CONTRACTOR_MANAGEMENT_UNAVAILABLE', 'No se pudo consultar Gestión del Contratista.');
        }
    }

    public function requisition(string $id): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== []) {
                return $this->fail(422, 'INVALID_FILTER', 'Este recurso no acepta parámetros.');
            }
            if (! preg_match(self::UUID, $id)) {
                return $this->fail(404, 'NOT_FOUND', 'Requisición no encontrada.');
            }
            $r = (new ContractorManagementReadRepository())->requisition((int) $this->actor['organization_id'], $id);
            return $r ? $this->respond(200, $r) : $this->fail(404, 'NOT_FOUND', 'Requisición no encontrada.');
        } catch (Throwable) {
            log_message('error', 'SupplyFlow contractor management requisition unavailable.');
            return $this->fail(503, 'CONTRACTOR_MANAGEMENT_UNAVAILABLE', 'No se pudo consultar la requisición.');
        }
    }
}
