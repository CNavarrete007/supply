<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\SupplyAuthRepository;
use App\Libraries\UserAccessConflict;
use App\Libraries\UserAccessInput;
use App\Libraries\UserAccessRepository;
use CodeIgniter\HTTP\ResponseInterface;
use InvalidArgumentException;
use mysqli_sql_exception;
use RuntimeException;
use Throwable;

/**
 * Usuarios y roles · gestión de acceso (25 nov 2026), solo Master Admin:
 *  - GET  api/v1/users/access-status        diagnóstico de la cuenta supplyflow_useradmin_local (sin secretos).
 *  - POST api/v1/users/{id}/access          {action: grant_master_admin|reset_password|revoke_master_admin, actor_password, reason}
 *    con CSRF, JSON, Idempotency-Key, If-Match (row_version del usuario) y REAUTENTICACIÓN: el administrador escribe su propia
 *    contraseña (5 intentos fallidos por 15 min). Nunca sobre la propia cuenta. La contraseña temporal se muestra una sola vez.
 */
final class UserAccessController extends BaseController
{
    private array $actor = [];

    private function reply(int $code, array $body): ResponseInterface
    {
        return $this->response->setStatusCode($code)->setHeader('Cache-Control', 'no-store')->setHeader('X-Content-Type-Options', 'nosniff')->setJSON($body);
    }

    private function fail(int $code, string $error, string $message, array $extra = []): ResponseInterface
    {
        return $this->reply($code, ['error' => ['code' => $error, 'message' => $message] + $extra]);
    }

    private function authorize(): ?ResponseInterface
    {
        try {
            $user = (new SupplyAuthRepository())->currentUser($_COOKIE['sf_session'] ?? null);
        } catch (Throwable) {
            return $this->fail(503, 'AUTH_UNAVAILABLE', 'No es posible validar la sesión.');
        }
        if (! $user) {
            return $this->fail(401, 'NOT_AUTHENTICATED', 'Inicia sesión para continuar.');
        }
        if (! in_array('master_admin', array_column($user['roles'] ?? [], 'code'), true)) {
            return $this->fail(403, 'FORBIDDEN', 'Solo un Master Admin administra accesos.');
        }
        $this->actor = $user;
        return null;
    }

    private function csrf(): bool
    {
        $cookie = $_COOKIE['sf_csrf'] ?? '';
        $header = $this->request->getHeaderLine('X-SF-CSRF');
        $origin = $this->request->getHeaderLine('Origin');
        if ($origin !== '') {
            $p = parse_url($origin);
            if (! is_array($p) || ! isset($p['host']) || strtolower($p['host'] . (isset($p['port']) ? ':' . $p['port'] : '')) !== strtolower($this->request->getHeaderLine('Host'))) {
                return false;
            }
        }
        return is_string($cookie) && preg_match('/^[a-f0-9]{64}$/D', $cookie) === 1 && preg_match('/^[a-f0-9]{64}$/D', $header) === 1 && hash_equals($cookie, $header);
    }

    /** Re-authentication limiter per administrator: 5 consecutive failures in 15 minutes block it; a success resets it. */
    private function reauthAllowed(?bool $failed): bool
    {
        $path = WRITEPATH . 'cache' . DIRECTORY_SEPARATOR . 'sf-reauth-' . hash('sha256', (string) $this->actor['id'] . "\n" . (string) $this->actor['organization_id']);
        $f = fopen($path, 'c+');
        if (! is_resource($f)) {
            throw new RuntimeException('REAUTH_LIMIT_UNAVAILABLE');
        }
        try {
            flock($f, LOCK_EX);
            $d = json_decode(stream_get_contents($f) ?: '{}', true);
            $now = time();
            $window = (int) ($d['window'] ?? $now);
            $count = (int) ($d['count'] ?? 0);
            if ($now - $window > 900 || $window > $now) {
                $window = $now;
                $count = 0;
            }
            $blocked = $count >= 5;
            if ($failed === true && ! $blocked) {
                $count++;
            } elseif ($failed === false && ! $blocked) {
                $count = 0;
            }
            rewind($f);
            ftruncate($f, 0);
            fwrite($f, json_encode(['window' => $window, 'count' => $count], JSON_THROW_ON_ERROR));
            return ! $blocked;
        } finally {
            flock($f, LOCK_UN);
            fclose($f);
        }
    }

    private function accountError(Throwable $e): ?ResponseInterface
    {
        if ($e instanceof RuntimeException && $e->getMessage() === 'USERADMIN_NOT_PROVISIONED') {
            return $this->fail(503, 'USERADMIN_NOT_PROVISIONED', 'La administración de accesos aún no está habilitada en este equipo (falta la cuenta supplyflow_useradmin_local). No se aplicaron cambios.');
        }
        if ($e instanceof mysqli_sql_exception) {
            $n = $e->getCode();
            if (in_array($n, [1044, 1045, 1698], true)) {
                return $this->fail(503, 'USERADMIN_ACCOUNT_REJECTED', 'MariaDB rechazó la cuenta de administración de usuarios (no existe o su contraseña no coincide). No se aplicaron cambios.');
            }
            if (in_array($n, [1142, 1143], true)) {
                return $this->fail(503, 'USERADMIN_GRANTS_INCOMPLETE', 'A la cuenta de administración de usuarios le faltan permisos en MariaDB. No se aplicaron cambios.');
            }
        }
        return null;
    }

    public function status(): ResponseInterface
    {
        if ($denied = $this->authorize()) {
            return $denied;
        }
        if ($this->request->getGet() !== []) {
            return $this->fail(422, 'INVALID_REQUEST', 'Parámetros no admitidos.');
        }
        $expected = UserAccessRepository::expectedGrants();
        try {
            $missing = (new UserAccessRepository())->missingGrants();
            $code = $missing ? 'USERADMIN_GRANTS_INCOMPLETE' : 'OK';
        } catch (Throwable $e) {
            $missing = [];
            $r = $this->accountError($e);
            $code = $r ? json_decode((string) $r->getBody(), true)['error']['code'] : 'USERADMIN_UNAVAILABLE';
        }
        return $this->reply(200, ['enabled' => $code === 'OK', 'code' => $code, 'expected_grants' => $expected, 'missing_grants' => $missing, 'read_only' => true]);
    }

    public function access(string $id): ResponseInterface
    {
        if ($denied = $this->authorize()) {
            return $denied;
        }
        if (! $this->csrf()) {
            return $this->fail(403, 'CSRF_INVALID', 'Solicitud no autorizada.');
        }
        $id = strtolower($id);
        if (preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D', $id) !== 1) {
            return $this->fail(404, 'NOT_FOUND', 'Usuario no encontrado.');
        }
        if (! str_starts_with(strtolower($this->request->getHeaderLine('Content-Type')), 'application/json')) {
            return $this->fail(415, 'JSON_REQUIRED', 'Se requiere JSON.');
        }
        if (strlen((string) $this->request->getBody()) > 8192) {
            return $this->fail(413, 'PAYLOAD_TOO_LARGE', 'La solicitud excede el límite.');
        }
        $key = $this->request->getHeaderLine('Idempotency-Key');
        if (preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/Di', $key) !== 1) {
            return $this->fail(422, 'IDEMPOTENCY_REQUIRED', 'Falta la identificación de la solicitud.');
        }
        if (preg_match('/^"([1-9][0-9]{0,15})"$/D', $this->request->getHeaderLine('If-Match'), $m) !== 1) {
            return $this->fail(428, 'VERSION_REQUIRED', 'Se necesita la versión vigente del usuario.');
        }
        try {
            $input = UserAccessInput::payload($this->request->getJSON(true));
        } catch (InvalidArgumentException $e) {
            $field = $e->getMessage();
            $msg = ['reason' => 'Escribe el motivo (10 a 500 caracteres).', 'actor_password' => 'Escribe tu contraseña para confirmar.', 'action' => 'Acción no válida.'][$field] ?? 'Datos no válidos.';
            return $this->fail(422, 'INVALID_ACCESS_REQUEST', $msg, ['field' => $field]);
        } catch (Throwable) {
            return $this->fail(422, 'INVALID_ACCESS_REQUEST', 'Datos no válidos.', ['field' => 'body']);
        }
        try {
            if (! $this->reauthAllowed(null)) {
                return $this->fail(429, 'TOO_MANY_ATTEMPTS', 'Demasiados intentos de confirmación. Espera 15 minutos.');
            }
            $me = (new SupplyAuthRepository())->authenticate(mb_strtolower((string) $this->actor['email'], 'UTF-8'), $input['actor_password']);
            if (! $me || (int) $me['id'] !== (int) $this->actor['id']) {
                $this->reauthAllowed(true);
                return $this->fail(403, 'REAUTH_FAILED', 'Tu contraseña no es correcta. No se aplicaron cambios.', ['field' => 'actor_password']);
            }
            $this->reauthAllowed(false);
            $out = (new UserAccessRepository())->apply((int) $this->actor['organization_id'], (int) $this->actor['id'], $id, (int) $m[1], $input['action'], $input['reason'], strtolower($key));
            return $this->reply(200, $out);
        } catch (UserAccessConflict $e) {
            return $this->fail($e->status, $e->errorCode, $e->getMessage());
        } catch (Throwable $e) {
            if ($r = $this->accountError($e)) {
                return $r;
            }
            log_message('error', 'SupplyFlow user access failed: {c}', ['c' => get_class($e)]);
            return $this->fail(503, 'USERADMIN_UNAVAILABLE', 'No se pudo aplicar el cambio de acceso. No se confirmaron cambios.');
        }
    }
}
