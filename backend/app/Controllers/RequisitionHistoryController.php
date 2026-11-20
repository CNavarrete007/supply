<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\RequisitionHistoryReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Requisición › Crear desde historial · read-only (Master Admin, cuenta API de solo SELECT).
 * GET api/v1/requisition-history/catalog?client={uuid} → política de recompra del cliente y catálogo histórico
 * (partidas de cotizaciones al cliente aprobadas con último precio, costo y proveedor).
 * Crear la requisición desde historial NO está expuesto: el alta RF1 no admite origen histórico ni tratamiento por
 * partida, y un endpoint propio requiere autorización explícita.
 */
final class RequisitionHistoryController extends ReadOnlyModuleController
{
    public function catalog(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            $f = $this->query(['client' => [self::UUID, '']], false);
            if ($f === null) {
                return $this->fail(422, 'INVALID_FILTER', 'Selecciona un cliente válido.');
            }
            $data = (new RequisitionHistoryReadRepository())->catalog((int) $this->actor['organization_id'], $f['client']);
            return $data ? $this->respond(200, $data) : $this->fail(404, 'NOT_FOUND', 'Cliente no encontrado.');
        } catch (Throwable) {
            log_message('error', 'SupplyFlow requisition history unavailable.');
            return $this->fail(503, 'HISTORY_UNAVAILABLE', 'No se pudo consultar el historial del cliente.');
        }
    }
}
