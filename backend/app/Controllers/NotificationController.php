<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\NotificationReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Campana de notificaciones, solo lectura: cualquier usuario interno activo con sesión ve únicamente SUS notificaciones
 * (destinatario = usuario en sesión). No hay rutas de escritura: marcar como leída requiere un permiso no autorizado.
 */
final class NotificationController extends ReadOnlyModuleController
{
    public function index(): ResponseInterface
    {
        try {
            if ($denied = $this->guardUser()) {
                return $denied;
            }
            $f = $this->query(['status' => ['/^(all|unread)$/D', 'all']]);
            if ($f === null) {
                return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
            }
            return $this->respond(200, (new NotificationReadRepository())->mine((int) $this->actor['organization_id'], (int) $this->actor['id'], $f));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow notifications unavailable.');
            return $this->fail(503, 'NOTIFICATIONS_UNAVAILABLE', 'No se pudieron consultar las notificaciones.');
        }
    }
}
