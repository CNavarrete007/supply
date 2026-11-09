<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\MatrixReadRepository;
use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/** Read-only requisition matrix. Never supplies legacy portal secrets or private files. */
final class MatrixController extends BaseController
{
    private function jsonResponse(int $status, array $payload): ResponseInterface
    {
        return $this->response->setStatusCode($status)
            ->setHeader('Cache-Control', 'private, no-store')
            ->setHeader('X-Content-Type-Options', 'nosniff')
            ->setJSON($payload);
    }

    private function authorize(): ?ResponseInterface
    {
        $actor = (new SupplyAuthRepository())->currentUser($_COOKIE['sf_session'] ?? null);
        if (! $actor) {
            return $this->jsonResponse(401, ['error' => ['code' => 'NOT_AUTHENTICATED', 'message' => 'Inicia sesión para consultar la Matriz.']]);
        }
        foreach (($actor['roles'] ?? []) as $role) {
            if (($role['code'] ?? '') === 'master_admin') {
                $this->actor = $actor;
                return null;
            }
        }
        return $this->jsonResponse(403, ['error' => ['code' => 'FORBIDDEN', 'message' => 'No tienes permisos para consultar la Matriz.']]);
    }

    /** @var array<string,mixed> */
    private array $actor = [];

    private function listFilters(): ?array
    {
        $input = $this->request->getGet();
        if (! is_array($input)) {
            return null;
        }
        foreach (['page','page_size','q','client','has'] as $key) {
            if (isset($input[$key]) && ! is_string($input[$key]) && ! is_int($input[$key])) {
                return null;
            }
        }
        $page = filter_var($input['page'] ?? '1', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
        $size = filter_var($input['page_size'] ?? '25', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 50]]);
        $q = trim((string) ($input['q'] ?? ''));
        $client = trim((string) ($input['client'] ?? 'all'));
        $has = trim((string) ($input['has'] ?? 'all'));
        $allowed = ['all','review','rfq','supplier_quote','customer_quote','purchase_order','receipt','delivery','invoice','without_purchase_order'];
        if ($page === false || $size === false || mb_strlen($q, 'UTF-8') > 120 ||
            ($client !== 'all' && ! preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/D', $client)) ||
            ! in_array($has, $allowed, true)) {
            return null;
        }
        return [(int) $page,(int) $size,$q,$client,$has];
    }

    public function requisitions(): ResponseInterface
    {
        try {
            if ($failure = $this->authorize()) {
                return $failure;
            }
            $filters = $this->listFilters();
            if ($filters === null) {
                return $this->jsonResponse(422, ['error' => ['code' => 'INVALID_FILTER', 'message' => 'Filtros de Matriz inválidos.']]);
            }
            $data = (new MatrixReadRepository())->listing((int) $this->actor['organization_id'], ...$filters);
            return $this->jsonResponse(200, $data);
        } catch (Throwable $error) {
            log_message('error', 'SupplyFlow matrix listing unavailable: ' . get_class($error) . ' code ' . $error->getCode());
            return $this->jsonResponse(503, ['error' => ['code' => 'MATRIX_UNAVAILABLE', 'message' => 'No fue posible consultar la Matriz.']]);
        }
    }

    public function clients(): ResponseInterface
    {
        try {
            if ($failure = $this->authorize()) {
                return $failure;
            }
            return $this->jsonResponse(200, (new MatrixReadRepository())->clients((int) $this->actor['organization_id']));
        } catch (Throwable $error) {
            log_message('error', 'SupplyFlow matrix clients unavailable: ' . get_class($error) . ' code ' . $error->getCode());
            return $this->jsonResponse(503, ['error' => ['code' => 'MATRIX_UNAVAILABLE', 'message' => 'No fue posible consultar los clientes.']]);
        }
    }

    public function detail(string $id): ResponseInterface
    {
        try {
            if ($failure = $this->authorize()) {
                return $failure;
            }
            if (! preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/D', $id)) {
                return $this->jsonResponse(404, ['error' => ['code' => 'NOT_FOUND', 'message' => 'Requisición no encontrada.']]);
            }
            $record = (new MatrixReadRepository())->detail((int) $this->actor['organization_id'], $id);
            if (! $record) {
                return $this->jsonResponse(404, ['error' => ['code' => 'NOT_FOUND', 'message' => 'Requisición no encontrada.']]);
            }
            return $this->jsonResponse(200, $record);
        } catch (Throwable $error) {
            log_message('error', 'SupplyFlow matrix detail unavailable: ' . get_class($error) . ' code ' . $error->getCode());
            return $this->jsonResponse(503, ['error' => ['code' => 'MATRIX_UNAVAILABLE', 'message' => 'No fue posible consultar el detalle.']]);
        }
    }
}
