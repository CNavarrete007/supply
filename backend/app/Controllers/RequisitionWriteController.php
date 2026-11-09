<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\RequisitionInput;
use App\Libraries\RequisitionWriteRepository;
use App\Libraries\RequisitionConflict;
use App\Libraries\RequisitionStale;
use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;
use InvalidArgumentException;
use Throwable;

/** v0.7: escritura exclusivamente de borradores nuevos del Master Admin. */
final class RequisitionWriteController extends BaseController
{
    private array $actor = [];

    private function reply(int $status, array $data): ResponseInterface
    {
        return $this->response->setStatusCode($status)
            ->setHeader('Cache-Control', 'private, no-store')
            ->setHeader('X-Content-Type-Options', 'nosniff')
            ->setJSON($data);
    }

    private function fail(int $status, string $code, string $message): ResponseInterface
    {
        return $this->reply($status, ['error'=>['code'=>$code,'message'=>$message]]);
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
        $allowed = false;
        foreach (($user['roles'] ?? []) as $role) {
            if (($role['code'] ?? '') === 'master_admin') {
                $allowed = true;
            }
        }
        if (! $allowed) {
            return $this->fail(403, 'FORBIDDEN', 'No cuentas con permisos para esta operación.');
        }
        $this->actor = $user;
        return null;
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
    private function validatedInput(): array|ResponseInterface
    {
        if (! $this->csrfValid()) {
            return $this->fail(403, 'CSRF_INVALID', 'Solicitud no autorizada.');
        }
        if (! str_starts_with(strtolower($this->request->getHeaderLine('Content-Type')), 'application/json')) {
            return $this->fail(415, 'JSON_REQUIRED', 'Se requiere JSON.');
        }
        if (strlen((string) $this->request->getBody()) > 160000) {
            return $this->fail(413, 'PAYLOAD_TOO_LARGE', 'Solicitud demasiado grande.');
        }
        try {
            return RequisitionInput::payload($this->request->getJSON(true));
        } catch (Throwable) {
            return $this->fail(422, 'INVALID_REQUISITION', 'Revisa las fechas, el cliente, las partidas y los importes.');
        }
    }

    private function key(): ?string
    {
        $key = $this->request->getHeaderLine('Idempotency-Key');
        return RequisitionInput::uuidValid($key) ? strtolower($key) : null;
    }

    private function handleError(Throwable $e): ResponseInterface
    {
        if ($e instanceof RequisitionStale) {
            return $this->fail(412, 'STALE_VERSION', $e->getMessage());
        }
        if ($e instanceof RequisitionConflict) {
            return $this->fail(409, $e->errorCode, $e->getMessage());
        }
        log_message('error', 'SupplyFlow v07 write failed: ' . get_class($e) . ' code ' . (string) $e->getCode());
        return $this->fail(503, 'REQUISITION_UNAVAILABLE', 'No se pudo completar la operación. No se confirmaron cambios parciales.');
    }

    public function create(): ResponseInterface
    {
        if ($failure = $this->authorize()) return $failure;
        $payload = $this->validatedInput();
        if ($payload instanceof ResponseInterface) return $payload;
        if (! $key = $this->key()) return $this->fail(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Falta la clave de solicitud.');
        try {
            $saved = (new RequisitionWriteRepository())->create((int)$this->actor['organization_id'], (int)$this->actor['id'], $payload, $key);
            return $this->reply($saved['replayed'] ? 200 : 201, $saved);
        } catch (Throwable $e) {
            return $this->handleError($e);
        }
    }

    public function update(string $id): ResponseInterface
    {
        if ($failure = $this->authorize()) return $failure;
        if (! RequisitionInput::uuidValid($id)) return $this->fail(404,'NOT_FOUND','Borrador no encontrado.');
        $payload = $this->validatedInput();
        if ($payload instanceof ResponseInterface) return $payload;
        if (! $key = $this->key()) return $this->fail(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Falta la clave de solicitud.');
        $match = $this->request->getHeaderLine('If-Match');
        if (! preg_match('/^"([1-9][0-9]{0,8})"$/D', $match, $captures)) {
            return $this->fail(428, 'IF_MATCH_REQUIRED', 'Se necesita la versión vigente del borrador.');
        }
        try {
            return $this->reply(200, (new RequisitionWriteRepository())->update((int)$this->actor['organization_id'], (int)$this->actor['id'], strtolower($id), (int)$captures[1], $payload, $key));
        } catch (Throwable $e) {
            return $this->handleError($e);
        }
    }

    public function drafts(): ResponseInterface
    {
        if ($failure = $this->authorize()) return $failure;
        try {
            return $this->reply(200, (new RequisitionWriteRepository())->drafts((int)$this->actor['organization_id'],(int)$this->actor['id']));
        } catch (Throwable $e) {
            return $this->handleError($e);
        }
    }

    public function detail(string $id): ResponseInterface
    {
        if ($failure = $this->authorize()) return $failure;
        if (! RequisitionInput::uuidValid($id)) return $this->fail(404,'NOT_FOUND','Borrador no encontrado.');
        try {
            $record = (new RequisitionWriteRepository())->draft((int)$this->actor['organization_id'],(int)$this->actor['id'],strtolower($id));
            return $record ? $this->reply(200, $record) : $this->fail(404, 'NOT_FOUND', 'Borrador no encontrado.');
        } catch (Throwable $e) {
            return $this->handleError($e);
        }
    }
}
