<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\CatalogReadRepository;
use App\Libraries\ClientConflict;
use App\Libraries\ClientInput;
use App\Libraries\ClientStale;
use App\Libraries\ClientWriteRepository;
use App\Libraries\ClientWriteUnavailable;
use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;
use InvalidArgumentException;
use Throwable;

/**
 * Catálogo de clientes · alta (POST) y actualización (PUT con If-Match) por Master Admin, y logotipo privado (GET).
 * Requiere la cuenta SQL supplyflow_catalogwrite_local (overlay compose.supply-catalogwrite.yml); sin ella responde 503
 * CATALOG_WRITE_NOT_PROVISIONED sin tocar datos. El portal del cliente no se administra aquí.
 */
final class ClientWriteController extends BaseController
{
    private array $actor = [];

    private function reply(int $status, array $data): ResponseInterface
    {
        return $this->response->setStatusCode($status)->setHeader('Cache-Control', 'private, no-store')
            ->setHeader('X-Content-Type-Options', 'nosniff')->setJSON($data);
    }

    private function fail(int $status, string $code, string $message, array $extra = []): ResponseInterface
    {
        return $this->reply($status, ['error' => ['code' => $code, 'message' => $message] + $extra]);
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
        foreach (($user['roles'] ?? []) as $role) {
            if (($role['code'] ?? '') === 'master_admin') {
                $this->actor = $user;
                return null;
            }
        }
        return $this->fail(403, 'FORBIDDEN', 'No cuentas con permisos para esta operación.');
    }

    private function csrfValid(): bool
    {
        $cookie = $_COOKIE['sf_csrf'] ?? '';
        $header = $this->request->getHeaderLine('X-SF-CSRF');
        $origin = $this->request->getHeaderLine('Origin');
        if ($origin !== '') {
            $parts = parse_url($origin);
            if (! is_array($parts) || ! isset($parts['host'])) {
                return false;
            }
            $host = strtolower((string) $parts['host']) . (isset($parts['port']) ? ':' . $parts['port'] : '');
            if ($host !== strtolower($this->request->getHeaderLine('Host'))) {
                return false;
            }
        }
        return is_string($cookie) && preg_match('/^[a-f0-9]{64}$/D', $cookie) === 1
            && preg_match('/^[a-f0-9]{64}$/D', $header) === 1 && hash_equals($cookie, $header);
    }

    /** @return array<string,mixed>|ResponseInterface */
    private function input(): array|ResponseInterface
    {
        if (! $this->csrfValid()) {
            return $this->fail(403, 'CSRF_INVALID', 'Solicitud no autorizada.');
        }
        if (! str_starts_with(strtolower($this->request->getHeaderLine('Content-Type')), 'application/json')) {
            return $this->fail(415, 'JSON_REQUIRED', 'Se requiere JSON.');
        }
        if (strlen((string) $this->request->getBody()) > 700000) {
            return $this->fail(413, 'PAYLOAD_TOO_LARGE', 'Solicitud demasiado grande (el logotipo admite hasta 400 KB).');
        }
        try {
            return ClientInput::payload(json_decode((string) $this->request->getBody(), true, 16, JSON_THROW_ON_ERROR));
        } catch (InvalidArgumentException $e) {
            return $this->fail(422, 'INVALID_CLIENT', 'Revisa los datos del cliente.', ['field' => $e->getMessage()]);
        } catch (Throwable) {
            return $this->fail(422, 'INVALID_CLIENT', 'Revisa los datos del cliente.', ['field' => 'body']);
        }
    }

    private function key(): ?string
    {
        $key = $this->request->getHeaderLine('Idempotency-Key');
        return ClientInput::uuidValid($key) ? strtolower($key) : null;
    }

    private function handle(Throwable $e): ResponseInterface
    {
        if ($e instanceof ClientStale) {
            return $this->fail(412, 'STALE_VERSION', $e->getMessage());
        }
        if ($e instanceof ClientConflict) {
            return $this->fail($e->errorCode === 'NOT_FOUND' ? 404 : ($e->errorCode === 'INVALID_POLICY' ? 422 : 409), $e->errorCode, $e->getMessage());
        }
        if ($e instanceof ClientWriteUnavailable && $e->getMessage() === 'CATALOG_WRITE_NOT_PROVISIONED') {
            return $this->fail(503, 'CATALOG_WRITE_NOT_PROVISIONED', 'El guardado de clientes aún no está habilitado en este equipo (falta aprovisionar la cuenta de escritura del catálogo). No se guardaron cambios.');
        }
        log_message('error', 'SupplyFlow client write failed: ' . get_class($e) . ' code ' . (string) $e->getCode());
        return $this->fail(503, 'CLIENT_WRITE_UNAVAILABLE', 'No se pudo guardar el cliente. No se confirmaron cambios parciales.');
    }

    public function create(): ResponseInterface
    {
        if ($denied = $this->authorize()) {
            return $denied;
        }
        $p = $this->input();
        if ($p instanceof ResponseInterface) {
            return $p;
        }
        if (! $key = $this->key()) {
            return $this->fail(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Falta la clave de solicitud.');
        }
        try {
            $saved = (new ClientWriteRepository())->create((int) $this->actor['organization_id'], (int) $this->actor['id'], $p, $key);
            return $this->reply($saved['replayed'] ? 200 : 201, $saved);
        } catch (Throwable $e) {
            return $this->handle($e);
        }
    }

    public function update(string $id): ResponseInterface
    {
        if ($denied = $this->authorize()) {
            return $denied;
        }
        if (! ClientInput::uuidValid($id)) {
            return $this->fail(404, 'NOT_FOUND', 'Cliente no encontrado.');
        }
        $p = $this->input();
        if ($p instanceof ResponseInterface) {
            return $p;
        }
        if (! $key = $this->key()) {
            return $this->fail(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Falta la clave de solicitud.');
        }
        if (! preg_match('/^"([1-9][0-9]{0,8})"$/D', $this->request->getHeaderLine('If-Match'), $m)) {
            return $this->fail(428, 'IF_MATCH_REQUIRED', 'Se necesita la versión vigente del cliente.');
        }
        try {
            return $this->reply(200, (new ClientWriteRepository())->update((int) $this->actor['organization_id'], (int) $this->actor['id'], strtolower($id), (int) $m[1], $p, $key));
        } catch (Throwable $e) {
            return $this->handle($e);
        }
    }

    /** Current client logo: image bytes only, never a storage path; strict headers so it can only render as an image. */
    public function logo(string $id): ResponseInterface
    {
        if ($denied = $this->authorize()) {
            return $denied;
        }
        if (! ClientInput::uuidValid($id) || $this->request->getGet() !== []) {
            return $this->fail(404, 'NOT_FOUND', 'Logotipo no encontrado.');
        }
        try {
            $f = (new CatalogReadRepository())->clientLogo((int) $this->actor['organization_id'], strtolower($id));
            $path = null;
            if ($f && $f['storage_backend'] === ClientWriteRepository::STORAGE && preg_match('~^[1-9][0-9]*/[a-f0-9]{64}\.(png|jpg|webp)$~D', $f['storage_key'])) {
                $path = WRITEPATH . 'supplyflow_catalog/files/' . $f['storage_key'];
            }
            $bytes = $path && is_file($path) ? (string) file_get_contents($path) : '';
            $info = $bytes !== '' ? ClientInput::image($bytes) : null;
            if (! $info || $info['mime'] !== $f['mime'] || hash('sha256', $bytes) !== strtolower($f['sha256'])) {
                return $this->fail(404, 'NOT_FOUND', 'Logotipo no encontrado.');
            }
            return $this->response->setStatusCode(200)->setHeader('Content-Type', $info['mime'])
                ->setHeader('Cache-Control', 'private, no-store')->setHeader('X-Content-Type-Options', 'nosniff')
                ->setHeader('Content-Security-Policy', "default-src 'none'; sandbox")->setHeader('Content-Disposition', 'inline; filename="logotipo.' . $info['ext'] . '"')
                ->setBody($bytes);
        } catch (Throwable) {
            log_message('error', 'SupplyFlow client logo unavailable.');
            return $this->fail(503, 'LOGO_UNAVAILABLE', 'No se pudo consultar el logotipo.');
        }
    }
}
