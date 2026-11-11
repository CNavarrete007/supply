<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\PurchaseOrderReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/** Órdenes de Compra · read-only. Issuing, authorizing, amending or deleting POs is NOT exposed. */
final class PurchaseOrderController extends ReadOnlyModuleController
{
    public function index(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            $f = $this->query([
                'q' => [self::TEXT, ''],
                'status' => [self::CODE_OR_ALL, 'all'],
                'buyer' => ['/^(all|none|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/D', 'all'],
                'sort' => ['/^(recent|oldest|amount)$/D', 'recent'],
                'scope' => ['/^(current|all)$/D', 'current'],
            ]);
            if ($f === null) {
                return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
            }
            return $this->respond(200, (new PurchaseOrderReadRepository())->list((int) $this->actor['organization_id'], $f));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow purchase orders unavailable.');
            return $this->fail(503, 'PO_UNAVAILABLE', 'No se pudieron consultar las órdenes de compra.');
        }
    }

    public function issuance(): ResponseInterface
    {
        return $this->simple(fn (PurchaseOrderReadRepository $r) => $r->issuance((int) $this->actor['organization_id']));
    }

    public function tasks(): ResponseInterface
    {
        return $this->simple(fn (PurchaseOrderReadRepository $r) => $r->tasks((int) $this->actor['organization_id'], (int) $this->actor['id']));
    }

    public function show(string $id): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== [] || ! preg_match(self::UUID, $id)) {
                return $this->fail($this->request->getGet() !== [] ? 422 : 404, $this->request->getGet() !== [] ? 'INVALID_FILTER' : 'NOT_FOUND', 'Orden de compra no encontrada.');
            }
            $detail = (new PurchaseOrderReadRepository())->detail((int) $this->actor['organization_id'], $id);
            return $detail ? $this->respond(200, $detail) : $this->fail(404, 'NOT_FOUND', 'Orden de compra no encontrada.');
        } catch (Throwable) {
            log_message('error', 'SupplyFlow purchase order detail unavailable.');
            return $this->fail(503, 'PO_UNAVAILABLE', 'No se pudo consultar la orden de compra.');
        }
    }

    private function simple(callable $fn): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->query([], false) === null) {
                return $this->fail(422, 'INVALID_FILTER', 'Este recurso no acepta parámetros.');
            }
            return $this->respond(200, $fn(new PurchaseOrderReadRepository()));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow purchase order view unavailable.');
            return $this->fail(503, 'PO_UNAVAILABLE', 'No se pudo consultar la información de órdenes de compra.');
        }
    }
}
