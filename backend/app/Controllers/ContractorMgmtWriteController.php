<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ClientInput;
use App\Libraries\ContractorMgmtInput;
use App\Libraries\ContractorMgmtWriteRepository;
use App\Libraries\MgmtConflict;
use App\Libraries\MgmtStale;
use App\Libraries\MgmtWriteUnavailable;
use App\Libraries\RequisitionHistoryReadRepository;
use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;
use InvalidArgumentException;
use Throwable;

/**
 * Gestión del Contratista · escrituras (Master Admin, cuenta supplyflow_mgmtwrite_local; 25 nov 2026):
 * - GET  /api/v1/contractor-management/write-status         diagnóstico de solo lectura de la cuenta (sin secretos).
 * - POST /api/v1/contractor-management/validations          alta de la validación interna (folio SCI automático).
 * - PUT  /api/v1/contractor-management/validations/{id}     edición (If-Match = versión; las importadas no se editan).
 * - PUT  /api/v1/contractor-management/strategy/{req}       estrategia como plan versionado (If-Match = versión vigente, "0" sin plan).
 * Sesión, CSRF, JSON, Idempotency-Key y errores comunes. No emite RFQ, cotizaciones ni OC.
 */
final class ContractorMgmtWriteController extends BaseController
{
    private array $actor = [];

    private function reply(int $status, array $data): ResponseInterface
    {
        return $this->response->setStatusCode($status)->setHeader('Cache-Control', 'private, no-store')->setHeader('X-Content-Type-Options', 'nosniff')->setJSON($data);
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
        if (! in_array('master_admin', array_column($user['roles'] ?? [], 'code'), true)) {
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
            if (strtolower((string) $parts['host']) . (isset($parts['port']) ? ':' . $parts['port'] : '') !== strtolower($this->request->getHeaderLine('Host'))) {
                return false;
            }
        }
        return is_string($cookie) && preg_match('/^[a-f0-9]{64}$/D', $cookie) === 1 && preg_match('/^[a-f0-9]{64}$/D', $header) === 1 && hash_equals($cookie, $header);
    }

    /** Common write boundary: session, role, CSRF, JSON, size and Idempotency-Key. Returns [json, key] or an error response. */
    private function boundary(): array|ResponseInterface
    {
        if ($denied = $this->authorize()) {
            return $denied;
        }
        if (! $this->csrfValid()) {
            return $this->fail(403, 'CSRF_INVALID', 'Solicitud no autorizada.');
        }
        if (! str_starts_with(strtolower($this->request->getHeaderLine('Content-Type')), 'application/json')) {
            return $this->fail(415, 'JSON_REQUIRED', 'Se requiere JSON.');
        }
        if (strlen((string) $this->request->getBody()) > 262144) {
            return $this->fail(413, 'PAYLOAD_TOO_LARGE', 'Solicitud demasiado grande.');
        }
        $key = $this->request->getHeaderLine('Idempotency-Key');
        if (! ClientInput::uuidValid($key)) {
            return $this->fail(422, 'IDEMPOTENCY_REQUIRED', 'Falta la identificación de la solicitud (Idempotency-Key).');
        }
        try {
            $json = json_decode((string) $this->request->getBody(), true, 16, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            $json = null;
        }
        return [$json, strtolower($key)];
    }

    private function handle(Throwable $e, string $invalid): ResponseInterface
    {
        if ($e instanceof InvalidArgumentException) {
            return $this->fail(422, $invalid, 'Revisa los datos capturados.', ['field' => $e->getMessage()]);
        }
        if ($e instanceof MgmtStale) {
            return $this->fail(412, 'STALE_VERSION', $e->getMessage());
        }
        if ($e instanceof MgmtConflict) {
            return $this->fail($e->status, $e->errorCode, $e->getMessage(), $e->field ? ['field' => $e->field] : []);
        }
        if ($e instanceof MgmtWriteUnavailable) {
            $messages = [
                'MGMT_WRITE_NOT_PROVISIONED' => 'El guardado de Gestión del Contratista no está habilitado en este equipo (falta la cuenta de escritura: overlay compose.supply-mgmtwrite.yml y su secreto). No se guardó nada.',
                'MGMT_WRITE_ACCOUNT_REJECTED' => 'MariaDB rechazó la cuenta de escritura de Gestión del Contratista (no existe o su contraseña no coincide con el secreto). No se guardó nada.',
            ];
            $code = $e->getMessage();
            return $this->fail(503, $code, $messages[$code] ?? 'No se pudo conectar con MariaDB para guardar. No se guardó nada.');
        }
        $errno = $e instanceof \mysqli_sql_exception ? (int) $e->getCode() : 0;
        if (in_array($errno, [1142, 1143, 1044], true)) {
            return $this->fail(503, 'MGMT_WRITE_GRANTS_INCOMPLETE', 'A la cuenta de escritura de Gestión del Contratista le faltan permisos en MariaDB. No se guardó nada.');
        }
        log_message('error', 'SupplyFlow contractor management write failed: ' . get_class($e) . ' errno ' . $errno);
        return $this->fail(503, 'MGMT_WRITE_UNAVAILABLE', 'No se pudo completar el guardado. No se confirmaron cambios parciales.');
    }

    private function today(): string
    {
        return (new RequisitionHistoryReadRepository())->businessToday((int) $this->actor['organization_id']);
    }

    public function writeStatus(): ResponseInterface
    {
        if ($denied = $this->authorize()) {
            return $denied;
        }
        if ($this->request->getGet() !== []) {
            return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
        }
        $body = ['enabled' => false, 'code' => 'MGMT_WRITE_UNAVAILABLE', 'expected_grants' => ContractorMgmtWriteRepository::expectedGrants(), 'missing_grants' => [], 'read_only' => true];
        try {
            $missing = (new ContractorMgmtWriteRepository())->missingGrants();
            $body['missing_grants'] = $missing;
            $body['enabled'] = $missing === [];
            $body['code'] = $missing === [] ? 'OK' : 'MGMT_WRITE_GRANTS_INCOMPLETE';
        } catch (MgmtWriteUnavailable $e) {
            $body['code'] = $e->getMessage();
        } catch (Throwable) {
            log_message('error', 'SupplyFlow contractor management write status check failed.');
        }
        return $this->reply(200, $body);
    }

    public function createReview(): ResponseInterface
    {
        $b = $this->boundary();
        if ($b instanceof ResponseInterface) {
            return $b;
        }
        [$json, $key] = $b;
        try {
            $today = $this->today();
            $p = ContractorMgmtInput::review($json, $today);
            $out = (new ContractorMgmtWriteRepository())->createReview((int) $this->actor['organization_id'], (int) $this->actor['id'], $p, $today, $key);
            return $this->reply($out['replayed'] ? 200 : 201, $out);
        } catch (Throwable $e) {
            return $this->handle($e, 'INVALID_VALIDATION');
        }
    }

    public function updateReview(string $id): ResponseInterface
    {
        $b = $this->boundary();
        if ($b instanceof ResponseInterface) {
            return $b;
        }
        [$json, $key] = $b;
        if (! ContractorMgmtInput::uuid(strtolower($id))) {
            return $this->fail(404, 'NOT_FOUND', 'Validación no encontrada.');
        }
        if (preg_match('/^"([1-9][0-9]{0,8})"$/D', $this->request->getHeaderLine('If-Match'), $m) !== 1) {
            return $this->fail(428, 'IF_MATCH_REQUIRED', 'Se necesita la versión vigente de la validación.');
        }
        try {
            $repo = new ContractorMgmtWriteRepository();
            $org = (int) $this->actor['organization_id'];
            $p = ContractorMgmtInput::review($json, $this->today(), true, $repo->reviewDeadline($org, strtolower($id)));
            return $this->reply(200, $repo->updateReview($org, (int) $this->actor['id'], strtolower($id), (int) $m[1], $p, $key));
        } catch (Throwable $e) {
            return $this->handle($e, 'INVALID_VALIDATION');
        }
    }

    public function saveStrategy(string $requisition): ResponseInterface
    {
        $b = $this->boundary();
        if ($b instanceof ResponseInterface) {
            return $b;
        }
        [$json, $key] = $b;
        if (! ContractorMgmtInput::uuid(strtolower($requisition))) {
            return $this->fail(404, 'NOT_FOUND', 'Requisición no encontrada.');
        }
        if (preg_match('/^"(0|[1-9][0-9]{0,8})"$/D', $this->request->getHeaderLine('If-Match'), $m) !== 1) {
            return $this->fail(428, 'IF_MATCH_REQUIRED', 'Se necesita la versión vigente de la estrategia ("0" si no hay plan).');
        }
        try {
            $p = ContractorMgmtInput::strategy($json);
            return $this->reply(200, (new ContractorMgmtWriteRepository())->saveStrategy((int) $this->actor['organization_id'], (int) $this->actor['id'], strtolower($requisition), (int) $m[1], $p, $key));
        } catch (Throwable $e) {
            return $this->handle($e, 'INVALID_STRATEGY');
        }
    }
}
