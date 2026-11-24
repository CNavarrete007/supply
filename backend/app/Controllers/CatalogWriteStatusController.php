<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\CatalogWriteBase;
use App\Libraries\CatalogWriteProbe;
use App\Libraries\CatalogWriteUnavailable;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * GET /api/v1/catalogs/write-status · ¿está habilitado el guardado de catálogos en este equipo? (Master Admin, solo lectura).
 * Diagnostica, sin escribir ni mostrar secretos, por qué Clientes, Proveedores, Suministros y Categorías no guardarían:
 * CATALOG_WRITE_NOT_PROVISIONED (la API se inició sin el overlay compose.supply-catalogwrite.yml o sin su secreto),
 * CATALOG_WRITE_ACCOUNT_REJECTED (MariaDB rechazó la cuenta: no existe o la contraseña no coincide con el secreto),
 * CATALOG_WRITE_GRANTS_INCOMPLETE (faltan permisos del contrato; se listan) o CATALOG_WRITE_UNAVAILABLE (otro error).
 */
final class CatalogWriteStatusController extends ReadOnlyModuleController
{
    public function index(): ResponseInterface
    {
        if ($denied = $this->guard()) {
            return $denied;
        }
        if ($this->query([], false) === null) {
            return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
        }
        $expected = array_sum(array_map('count', CatalogWriteBase::GRANTS));
        $body = ['enabled' => false, 'code' => 'CATALOG_WRITE_UNAVAILABLE', 'expected_grants' => $expected, 'missing_grants' => [], 'read_only' => true];
        try {
            $missing = (new CatalogWriteProbe())->missingGrants();
            $body['missing_grants'] = $missing;
            $body['enabled'] = $missing === [];
            $body['code'] = $missing === [] ? 'OK' : 'CATALOG_WRITE_GRANTS_INCOMPLETE';
        } catch (CatalogWriteUnavailable $e) {
            $body['code'] = $e->getMessage();
        } catch (Throwable) {
            log_message('error', 'SupplyFlow catalog write status check failed.');
        }
        return $this->respond(200, $body);
    }
}
