<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\CatalogReadRepository;
use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/** Authenticated, Master-Admin-only, read-only endpoints for imported master catalogs. */
final class CatalogDirectoryController extends BaseController
{
    private function respond(int $status, array $body): ResponseInterface
    {
        return $this->response->setStatusCode($status)
            ->setHeader('Cache-Control', 'no-store, private')
            ->setHeader('X-Content-Type-Options', 'nosniff')
            ->setJSON($body);
    }

    private function actor(): ?array
    {
        $repo = new SupplyAuthRepository();
        return $repo->currentUser($_COOKIE['sf_session'] ?? null);
    }

    private function canRead(array $actor): bool
    {
        // Deliberately Master Admin only until the catalog permission matrix is approved.
        foreach ($actor['roles'] ?? [] as $role) {
            if (($role['code'] ?? '') === 'master_admin') {
                return true;
            }
        }
        return false;
    }

    private function params(): ?array
    {
        $query = $this->request->getGet();
        if (! is_array($query)) {
            return null;
        }
        foreach (['page', 'page_size', 'q', 'status'] as $field) {
            if (isset($query[$field]) && ! is_string($query[$field]) && ! is_int($query[$field])) {
                return null;
            }
        }
        $page = filter_var($query['page'] ?? '1', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
        $size = filter_var($query['page_size'] ?? '25', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 50]]);
        $search = trim((string) ($query['q'] ?? ''));
        $status = trim((string) ($query['status'] ?? 'all'));
        if ($page === false || $size === false || mb_strlen($search, 'UTF-8') > 120 || ! preg_match('/^(all|[a-z][a-z0-9_\-]{0,31})$/D', $status)) {
            return null;
        }
        return [(int) $page, (int) $size, $search, $status];
    }

    private function listing(string $kind): ResponseInterface
    {
        try {
            $user = $this->actor();
            if (! $user) {
                return $this->respond(401, ['error' => ['code' => 'NOT_AUTHENTICATED', 'message' => 'Se requiere iniciar sesión.']]);
            }
            if (! $this->canRead($user)) {
                return $this->respond(403, ['error' => ['code' => 'FORBIDDEN', 'message' => 'No tienes acceso a este catálogo.']]);
            }
            $params = $this->params();
            if ($params === null) {
                return $this->respond(422, ['error' => ['code' => 'INVALID_FILTER', 'message' => 'Parámetros de consulta inválidos.']]);
            }
            $result = (new CatalogReadRepository())->list($kind, (int) $user['organization_id'], ...$params);
            return $this->respond(200, $result);
        } catch (Throwable) {
            log_message('error', 'SupplyFlow catalog listing unavailable.');
            return $this->respond(503, ['error' => ['code' => 'CATALOG_UNAVAILABLE', 'message' => 'No se pudo consultar el catálogo.']]);
        }
    }

    private function record(string $kind, string $id): ResponseInterface
    {
        try {
            $user = $this->actor();
            if (! $user) {
                return $this->respond(401, ['error' => ['code' => 'NOT_AUTHENTICATED', 'message' => 'Se requiere iniciar sesión.']]);
            }
            if (! $this->canRead($user)) {
                return $this->respond(403, ['error' => ['code' => 'FORBIDDEN', 'message' => 'No tienes acceso a este catálogo.']]);
            }
            if (! preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/D', $id)) {
                return $this->respond(404, ['error' => ['code' => 'NOT_FOUND', 'message' => 'Registro no encontrado.']]);
            }
            $record = (new CatalogReadRepository())->detail($kind, (int) $user['organization_id'], $id);
            if (! $record) {
                return $this->respond(404, ['error' => ['code' => 'NOT_FOUND', 'message' => 'Registro no encontrado.']]);
            }
            return $this->respond(200, ['item' => $record]);
        } catch (Throwable) {
            log_message('error', 'SupplyFlow catalog detail unavailable.');
            return $this->respond(503, ['error' => ['code' => 'CATALOG_UNAVAILABLE', 'message' => 'No se pudo consultar el detalle.']]);
        }
    }

    public function clients(): ResponseInterface { return $this->listing('clients'); }
    public function suppliers(): ResponseInterface { return $this->listing('suppliers'); }
    public function client(string $id): ResponseInterface { return $this->record('clients', $id); }
    public function supplier(string $id): ResponseInterface { return $this->record('suppliers', $id); }
}
