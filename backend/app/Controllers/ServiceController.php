<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ServiceReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Servicios Operativos · read-only (Master Admin). Section 3 "Matriz de servicios" and the service request view.
 * Registering, editing or deleting services is NOT exposed (no write routes).
 */
final class ServiceController extends ReadOnlyModuleController
{
    public function matrix(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            $f = $this->query([
                'client' => [self::UUID_OR_ALL, 'all'],
                'buyer' => ['/^(all|unassigned|legacy-[0-9a-f]{16}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/D', 'all'],
                'service' => [self::TEXT, ''], 'status' => [self::TEXT, ''], 'q' => [self::TEXT, ''],
            ]);
            if ($f === null) {
                return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
            }
            return $this->respond(200, (new ServiceReadRepository())->matrix((int) $this->actor['organization_id'], $f));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow services matrix unavailable.');
            return $this->fail(503, 'SERVICES_UNAVAILABLE', 'No se pudo consultar la matriz de servicios.');
        }
    }

    public function show(string $id): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== []) {
                return $this->fail(422, 'INVALID_FILTER', 'Este recurso no acepta parámetros.');
            }
            if (! preg_match(self::UUID, $id)) {
                return $this->fail(404, 'NOT_FOUND', 'Servicio no encontrado.');
            }
            $r = (new ServiceReadRepository())->service((int) $this->actor['organization_id'], $id);
            return $r ? $this->respond(200, $r) : $this->fail(404, 'NOT_FOUND', 'Servicio no encontrado.');
        } catch (Throwable) {
            log_message('error', 'SupplyFlow service detail unavailable.');
            return $this->fail(503, 'SERVICES_UNAVAILABLE', 'No se pudo consultar el servicio.');
        }
    }
}
