<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ClientPortalReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Portal del Cliente · VISTA PREVIA INTERNA (Master Admin, solo lectura): muestra exactamente lo que vería un cliente.
 * El acceso externo de clientes (tokens, sesiones client_portal) NO está habilitado: requiere permisos y escrituras
 * pendientes de autorización. Ninguna ruta de este controlador escribe.
 */
final class ClientPortalPreviewController extends ReadOnlyModuleController
{
    private const ID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D';

    /** @param callable(ClientPortalReadRepository,int):?array $read */
    private function run(callable $read): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== []) {
                return $this->fail(422, 'INVALID_FILTER', 'Este recurso no acepta parámetros.');
            }
            $out = $read(new ClientPortalReadRepository(), (int) $this->actor['organization_id']);
            return $out === null ? $this->fail(404, 'NOT_FOUND', 'No existe o el cliente no puede verlo.') : $this->respond(200, $out);
        } catch (Throwable) {
            log_message('error', 'SupplyFlow client portal preview unavailable.');
            return $this->fail(503, 'CLIENT_PORTAL_UNAVAILABLE', 'No se pudo consultar el portal del cliente.');
        }
    }

    public function clients(): ResponseInterface
    {
        return $this->run(static fn ($repo, $org) => ['items' => $repo->clients($org), 'read_only' => true, 'external_access_enabled' => false]);
    }

    public function client(string $client): ResponseInterface
    {
        return $this->run(static function ($repo, $org) use ($client) {
            $id = preg_match(self::ID, $client) ? $repo->clientId($org, $client) : null;
            return $id === null ? null : $repo->overview($org, $id);
        });
    }

    public function requisition(string $client, string $requisition): ResponseInterface
    {
        return $this->run(static function ($repo, $org) use ($client, $requisition) {
            $id = preg_match(self::ID, $client) && preg_match(self::ID, $requisition) ? $repo->clientId($org, $client) : null;
            return $id === null ? null : $repo->requisition($org, $id, $requisition);
        });
    }

    public function quote(string $client, string $quote): ResponseInterface
    {
        return $this->run(static function ($repo, $org) use ($client, $quote) {
            $id = preg_match(self::ID, $client) && preg_match(self::ID, $quote) ? $repo->clientId($org, $client) : null;
            return $id === null ? null : $repo->quote($org, $id, $quote);
        });
    }
}
