<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;
use RuntimeException;
use Throwable;

final class AuthController extends BaseController
{
    private const SESSION_COOKIE = 'sf_session';
    private const CSRF_COOKIE = 'sf_csrf';

    private function cookieOptions(int $expires, bool $httpOnly): array
    {
        $https = strtolower((string) ($this->request->getServer('HTTP_X_FORWARDED_PROTO') ?: '')) === 'https'
            || strtolower((string) ($this->request->getServer('HTTPS') ?: '')) === 'on';
        return ['expires' => $expires, 'path' => '/', 'secure' => $https, 'httponly' => $httpOnly, 'samesite' => 'Strict'];
    }

    public function csrf(): ResponseInterface
    {
        $value = bin2hex(random_bytes(32));
        setcookie(self::CSRF_COOKIE, $value, $this->cookieOptions(time() + 3600, false));
        return $this->response->setJSON(['csrf_token' => $value]);
    }

    private function requireCsrf(): bool
    {
        $cookie = $_COOKIE[self::CSRF_COOKIE] ?? '';
        $header = $this->request->getHeaderLine('X-SF-CSRF');
        $origin = $this->request->getHeaderLine('Origin');
        if ($origin !== '') {
            $parts = parse_url($origin);
            if (! is_array($parts) || ! isset($parts['host'])) {
                return false;
            }
            $originHost = strtolower((string) $parts['host']) . (isset($parts['port']) ? ':' . $parts['port'] : '');
            if ($originHost !== strtolower($this->request->getHeaderLine('Host'))) {
                return false;
            }
        }
        return is_string($cookie) && preg_match('/^[a-f0-9]{64}$/D', $cookie) === 1
            && preg_match('/^[a-f0-9]{64}$/D', $header) === 1 && hash_equals($cookie, $header);
    }

    private function fail(int $status, string $code, string $message): ResponseInterface
    {
        return $this->response->setStatusCode($status)->setJSON(['error' => ['code' => $code, 'message' => $message]]);
    }

    /** Rate limiter uses a private writable volume and fails closed if unavailable. */
    private function attempt(string $email, bool $failed): bool
    {
        $ip = (string) ($this->request->getIPAddress() ?: 'unknown');
        $path = WRITEPATH . 'cache' . DIRECTORY_SEPARATOR . 'sf-auth-' . hash('sha256', $ip . "\n" . $email);
        $f = fopen($path, 'c+');
        if (! is_resource($f)) {
            throw new RuntimeException('AUTH_RATE_LIMIT_UNAVAILABLE');
        }
        try {
            if (! flock($f, LOCK_EX)) {
                throw new RuntimeException('AUTH_RATE_LIMIT_UNAVAILABLE');
            }
            $data = json_decode(stream_get_contents($f) ?: '{}', true);
            $now = time();
            $window = (int) ($data['window'] ?? $now);
            $count = (int) ($data['count'] ?? 0);
            if ($now - $window > 900 || $window > $now) {
                $window = $now;
                $count = 0;
            }
            $blocked = $count >= 5;
            if ($failed && ! $blocked) {
                $count++;
            } elseif (! $failed && ! $blocked) {
                $count = 0;
            }
            rewind($f);
            ftruncate($f, 0);
            fwrite($f, json_encode(['window' => $window, 'count' => $count], JSON_THROW_ON_ERROR));
            fflush($f);
            return ! $blocked;
        } finally {
            flock($f, LOCK_UN);
            fclose($f);
        }
    }

    public function login(): ResponseInterface
    {
        if (! $this->requireCsrf()) {
            return $this->fail(403, 'CSRF_INVALID', 'Solicitud no autorizada.');
        }
        if (! str_starts_with(strtolower($this->request->getHeaderLine('Content-Type')), 'application/json')) {
            return $this->fail(415, 'JSON_REQUIRED', 'Se requiere JSON.');
        }
        try {
            $body = $this->request->getJSON(true);
            if (! is_array($body) || count($body) > 4) {
                return $this->fail(422, 'INVALID_INPUT', 'Datos de acceso no válidos.');
            }
            $email = mb_strtolower(trim((string) ($body['email'] ?? '')), 'UTF-8');
            $password = $body['password'] ?? null;
            if (! filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254
                || ! is_string($password) || strlen($password) < 1 || strlen($password) > 1024) {
                return $this->fail(422, 'INVALID_INPUT', 'Datos de acceso no válidos.');
            }
            if (! $this->attempt($email, false)) {
                return $this->fail(429, 'TOO_MANY_ATTEMPTS', 'Demasiados intentos. Prueba más tarde.');
            }
            $repo = new SupplyAuthRepository();
            $account = $repo->authenticate($email, $password);
            if ($account === null) {
                $this->attempt($email, true);
                return $this->fail(401, 'INVALID_CREDENTIALS', 'Credenciales incorrectas o cuenta sin activar.');
            }
            $issued = $repo->issueSession($account);
            $this->attempt($email, false);
            setcookie(self::SESSION_COOKIE, $issued['token'], $this->cookieOptions(time() + 8 * 3600, true));
            return $this->response->setJSON(['status' => 'authenticated', 'user' => $issued['user']]);
        } catch (Throwable $e) {
            log_message('error', 'SupplyFlow auth login failed: {code}', ['code' => $e instanceof RuntimeException ? 'AUTH_RUNTIME' : 'AUTH_ERROR']);
            return $this->fail(503, 'AUTH_UNAVAILABLE', 'Autenticación temporalmente no disponible.');
        }
    }

    public function me(): ResponseInterface
    {
        try {
            $repo = new SupplyAuthRepository();
            $current = $repo->currentUser($_COOKIE[self::SESSION_COOKIE] ?? null);
            if (! $current) {
                return $this->fail(401, 'NOT_AUTHENTICATED', 'No hay una sesión válida.');
            }
            return $this->response->setJSON(['status' => 'authenticated', 'user' => [
                'public_id' => $current['public_id'], 'email' => $current['email'], 'name' => $current['name'], 'roles' => $current['roles'],
            ]]);
        } catch (Throwable) {
            return $this->fail(503, 'AUTH_UNAVAILABLE', 'Autenticación temporalmente no disponible.');
        }
    }

    public function logout(): ResponseInterface
    {
        if (! $this->requireCsrf()) {
            return $this->fail(403, 'CSRF_INVALID', 'Solicitud no autorizada.');
        }
        try {
            $repo = new SupplyAuthRepository();
            $current = $repo->currentUser($_COOKIE[self::SESSION_COOKIE] ?? null);
            if ($current) {
                $repo->logout($current['session_id'], $current['organization_id'], $current['id']);
            }
            setcookie(self::SESSION_COOKIE, '', $this->cookieOptions(time() - 3600, true));
            return $this->response->setJSON(['status' => 'signed_out']);
        } catch (Throwable) {
            return $this->fail(503, 'AUTH_UNAVAILABLE', 'No se pudo cerrar sesión; reintenta.');
        }
    }
}
