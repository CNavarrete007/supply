<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ProcessFlowReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Flujo del Proceso, solo lectura (Master Admin): procesos por etapa de Procure-to-Pay (15) y Service-to-Cash (8),
 * indicadores de cada pestaña y cuellos de botella, derivados de la evidencia documental de MariaDB. Sin escrituras.
 */
final class ProcessFlowController extends ReadOnlyModuleController
{
    public function index(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== []) {
                return $this->fail(422, 'INVALID_FILTER', 'Este recurso no acepta parámetros.');
            }
            return $this->respond(200, (new ProcessFlowReadRepository())->overview((int) $this->actor['organization_id']));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow process flow unavailable.');
            return $this->fail(503, 'PROCESS_FLOW_UNAVAILABLE', 'No se pudo consultar el flujo del proceso.');
        }
    }
}
