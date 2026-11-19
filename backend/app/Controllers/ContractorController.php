<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ContractorReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Contratista · read-only (Master Admin). The contractor company is the session organization; registering, editing,
 * activating or deleting contractor companies and their personnel is NOT exposed (no write routes).
 */
final class ContractorController extends ReadOnlyModuleController
{
    public function index(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            $f = $this->query(['q' => [self::TEXT, ''], 'status' => ['/^(all|active|inactive)$/D', 'all']], false);
            if ($f === null) {
                return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
            }
            return $this->respond(200, (new ContractorReadRepository())->list((int) $this->actor['organization_id'], $f));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow contractors unavailable.');
            return $this->fail(503, 'CONTRACTORS_UNAVAILABLE', 'No se pudo consultar Contratista.');
        }
    }

    public function personnel(string $id): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== []) {
                return $this->fail(422, 'INVALID_FILTER', 'Este recurso no acepta parámetros.');
            }
            if (! preg_match(self::UUID, $id)) {
                return $this->fail(404, 'NOT_FOUND', 'Contratista no encontrado.');
            }
            $r = (new ContractorReadRepository())->personnel((int) $this->actor['organization_id'], $id);
            return $r ? $this->respond(200, $r) : $this->fail(404, 'NOT_FOUND', 'Contratista no encontrado.');
        } catch (Throwable) {
            log_message('error', 'SupplyFlow contractor personnel unavailable.');
            return $this->fail(503, 'CONTRACTORS_UNAVAILABLE', 'No se pudo consultar el personal del contratista.');
        }
    }
}
