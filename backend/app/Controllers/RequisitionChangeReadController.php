<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\RequisitionChangeReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Requisiciones › Control de cambios · read-only (Master Admin, cuenta API de solo SELECT).
 * GET api/v1/requisition-changes            historial completo y KPI.
 * GET api/v1/requisition-changes/candidates requisiciones y si admiten solicitud R3A.
 * Las escrituras (crear, retirar, aprobar o rechazar) siguen exclusivamente en RequisitionChangeController.
 */
final class RequisitionChangeReadController extends ReadOnlyModuleController
{
    public function overview(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            $f = $this->query([
                'status' => ['/^(all|closed|' . implode('|', RequisitionChangeReadRepository::STATUSES) . ')$/D', 'all'],
                'scope' => ['/^(all|mine|review|imported)$/D', 'all'],
                'state' => ['/^(all|applied|intervention|' . implode('|', RequisitionChangeReadRepository::FLOW_STATES) . ')$/D', 'all'],
                'q' => [self::TEXT, ''],
            ]);
            if ($f === null) {
                return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
            }
            return $this->respond(200, (new RequisitionChangeReadRepository())->overview(
                (int) $this->actor['organization_id'], (int) $this->actor['id'], $f));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow requisition changes overview unavailable.');
            return $this->fail(503, 'CHANGES_UNAVAILABLE', 'No se pudo consultar el control de cambios.');
        }
    }

    public function candidates(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            $f = $this->query(['scope' => ['/^(eligible|all)$/D', 'eligible'], 'q' => [self::TEXT, '']]);
            if ($f === null) {
                return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
            }
            return $this->respond(200, (new RequisitionChangeReadRepository())->candidates(
                (int) $this->actor['organization_id'], (int) $this->actor['id'], $f));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow requisition change candidates unavailable.');
            return $this->fail(503, 'CHANGES_UNAVAILABLE', 'No se pudieron consultar las requisiciones.');
        }
    }
}
