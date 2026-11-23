<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\SettingsReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Configuración · pestañas 1 a 5, solo lectura (Master Admin): parámetros del sistema original guardados en
 * organization_settings, política de aprobación vigente, historial de correos y logotipo del contratista.
 * Guardar configuración, importar respaldos o reiniciar NO están expuestos (no hay rutas de escritura).
 */
final class SettingsController extends ReadOnlyModuleController
{
    public function index(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== []) {
                return $this->fail(422, 'INVALID_FILTER', 'Este recurso no acepta parámetros.');
            }
            return $this->respond(200, (new SettingsReadRepository())->settings((int) $this->actor['organization_id']));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow settings unavailable.');
            return $this->fail(503, 'SETTINGS_UNAVAILABLE', 'No se pudo consultar la configuración.');
        }
    }

    public function emailLog(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            $f = $this->query(['q' => [self::TEXT, ''], 'status' => [self::TEXT, '']]);
            if ($f === null) {
                return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
            }
            return $this->respond(200, (new SettingsReadRepository())->emailLog((int) $this->actor['organization_id'], $f));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow email log unavailable.');
            return $this->fail(503, 'SETTINGS_UNAVAILABLE', 'No se pudo consultar el historial de correos.');
        }
    }

    public function logo(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== []) {
                return $this->fail(404, 'NOT_FOUND', 'Logotipo no encontrado.');
            }
            $f = (new SettingsReadRepository())->logo((int) $this->actor['organization_id']);
            if (! $f) {
                return $this->fail(404, 'NOT_FOUND', 'Logotipo no disponible.');
            }
            return $this->response->setStatusCode(200)->setHeader('Content-Type', $f['mime'])
                ->setHeader('Cache-Control', 'private, no-store')->setHeader('X-Content-Type-Options', 'nosniff')
                ->setHeader('Content-Security-Policy', "default-src 'none'; sandbox")->setHeader('Content-Disposition', 'inline; filename="logotipo.' . $f['ext'] . '"')
                ->setBody($f['bytes']);
        } catch (Throwable) {
            log_message('error', 'SupplyFlow settings logo unavailable.');
            return $this->fail(503, 'LOGO_UNAVAILABLE', 'No se pudo consultar el logotipo.');
        }
    }
}
