<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ServiceReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Servicios Operativos · read-only (Master Admin). Section 3 "Matriz de servicios", the service request view and the
 * data of section 4 "Reportes" (matrix filtered by request date range).
 * Section 2 "Nueva solicitud": service-type catalog, suggested internal reference and folio availability (read-only).
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
                'from' => ['/^(|\d{4}-\d{2}-\d{2})$/D', ''], 'to' => ['/^(|\d{4}-\d{2}-\d{2})$/D', ''],
            ]);
            if ($f !== null && ((($f['from'] !== '') && ! self::validDate($f['from'])) || (($f['to'] !== '') && ! self::validDate($f['to'])) || ($f['from'] !== '' && $f['to'] !== '' && $f['from'] > $f['to']))) {
                $f = null;
            }
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

    /* ---- Sección 2 "Nueva solicitud": solo lectura (catálogo, referencia sugerida, disponibilidad). Sin escrituras. ---- */

    public function newRequest(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== []) {
                return $this->fail(422, 'INVALID_FILTER', 'Este recurso no acepta parámetros.');
            }
            return $this->respond(200, (new ServiceReadRepository())->newRequestCatalog((int) $this->actor['organization_id']));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow service request catalog unavailable.');
            return $this->fail(503, 'SERVICES_UNAVAILABLE', 'No se pudo consultar el catálogo de servicios.');
        }
    }

    public function newRequestReference(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            $p = $this->textParams(['project' => 255, 'date' => 10]);
            if ($p === null || ! self::validDate($p['date'])) {
                return $this->fail(422, 'INVALID_FILTER', 'Captura una fecha de solicitud válida (AAAA-MM-DD) y un proyecto de hasta 255 caracteres.');
            }
            return $this->respond(200, (new ServiceReadRepository())->nextInternalReference((int) $this->actor['organization_id'], $p['project'], $p['date']));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow service reference unavailable.');
            return $this->fail(503, 'SERVICES_UNAVAILABLE', 'No se pudo generar la referencia interna.');
        }
    }

    public function newRequestAvailability(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            $p = $this->textParams(['folio' => 128, 'reference' => 255]);
            if ($p === null || ($p['folio'] === '' && $p['reference'] === '')) {
                return $this->fail(422, 'INVALID_FILTER', 'Indica el folio (hasta 128 caracteres) o la referencia interna (hasta 255) a verificar.');
            }
            return $this->respond(200, (new ServiceReadRepository())->newRequestAvailability((int) $this->actor['organization_id'], $p['folio'], $p['reference']));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow service availability unavailable.');
            return $this->fail(503, 'SERVICES_UNAVAILABLE', 'No se pudo verificar el folio.');
        }
    }

    /**
     * Strict allowlist of text parameters (name => max characters): unknown keys, arrays or control characters → null.
     * @return array<string,string>|null
     */
    private function textParams(array $limits): ?array
    {
        $query = $this->request->getGet();
        if (! is_array($query) || array_diff(array_keys($query), array_keys($limits)) !== []) {
            return null;
        }
        $out = [];
        foreach ($limits as $name => $max) {
            $v = $query[$name] ?? '';
            if (! is_string($v) || ! preg_match(self::TEXT, $v)) {
                return null;
            }
            $v = trim($v);
            if (mb_strlen($v, 'UTF-8') > $max) {
                return null;
            }
            $out[$name] = $v;
        }
        return $out;
    }

    private static function validDate(string $d): bool
    {
        $x = \DateTimeImmutable::createFromFormat('!Y-m-d', $d);
        return $x !== false && $x->format('Y-m-d') === $d;
    }
}
