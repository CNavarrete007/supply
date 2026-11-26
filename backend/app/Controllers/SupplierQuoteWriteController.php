<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ClientInput;
use App\Libraries\CustomerQuoteInput;
use App\Libraries\CustomerQuoteWriteRepository;
use App\Libraries\QuoteConflict;
use App\Libraries\QuoteStale;
use App\Libraries\QuoteWriteUnavailable;
use App\Libraries\RequisitionHistoryReadRepository;
use App\Libraries\RfqInput;
use App\Libraries\RfqWriteRepository;
use App\Libraries\SupplierQuoteInput;
use App\Libraries\SupplierQuoteWriteRepository;
use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;
use InvalidArgumentException;
use Throwable;

/**
 * Cotizaciones · escrituras (Master Admin, cuenta supplyflow_quotewrite_local; 26 nov 2026):
 * - GET  /api/v1/quotes/write-status                 diagnóstico de solo lectura de la cuenta (sin secretos).
 * - POST /api/v1/quotes/rfqs                         tarjeta 2: registro de la RFQ (Borrador o Enviada; SupplyFlow no envía correos).
 * - POST /api/v1/quotes/rfqs/{id}/mark-sent          tarjeta 3: un Borrador registrado en SupplyFlow pasa a Enviada (If-Match).
 * - POST /api/v1/quotes/supplier-quotes              tarjeta 4: registro interno de la cotización recibida contra una RFQ enviada.
 * - PUT  /api/v1/quotes/supplier-quotes/{id}         edición (If-Match = versión) de las registradas en SupplyFlow sin adjudicar.
 * - POST /api/v1/quotes/customer-quotes              tarjeta 6: cotización al cliente como BORRADOR INTERNO (Rev. 0, folio COT).
 * - PUT  /api/v1/quotes/customer-quotes/{id}         edición del borrador (If-Match); no emite, no autoriza ni envía.
 * Sesión, CSRF, JSON, Idempotency-Key y errores comunes. No adjudica, no emite ni autoriza cotizaciones al cliente ni crea OC.
 */
final class SupplierQuoteWriteController extends BaseController
{
    /** 8 MB de PDF en base64 + encabezado y partidas: límite de transporte del gateway (client_max_body_size 12m). */
    private const MAX_BODY = 12582912;
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
        $body = (string) $this->request->getBody();
        if ((int) $this->request->getHeaderLine('Content-Length') > self::MAX_BODY || strlen($body) > self::MAX_BODY) {
            return $this->fail(413, 'PAYLOAD_TOO_LARGE', 'Solicitud demasiado grande (el PDF admite hasta 8 MB).');
        }
        $key = $this->request->getHeaderLine('Idempotency-Key');
        if (! ClientInput::uuidValid($key)) {
            return $this->fail(422, 'IDEMPOTENCY_REQUIRED', 'Falta la identificación de la solicitud (Idempotency-Key).');
        }
        try {
            $json = json_decode($body, true, 16, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            $json = null;
        }
        return [$json, strtolower($key)];
    }

    private function handle(Throwable $e, string $invalid = 'INVALID_QUOTE'): ResponseInterface
    {
        if ($e instanceof InvalidArgumentException) {
            return $this->fail(422, $invalid, 'Revisa los datos capturados.', ['field' => $e->getMessage()]);
        }
        if ($e instanceof QuoteStale) {
            return $this->fail(412, 'STALE_VERSION', $e->getMessage());
        }
        if ($e instanceof QuoteConflict) {
            return $this->fail($e->status, $e->errorCode, $e->getMessage(), $e->field ? ['field' => $e->field] : []);
        }
        if ($e instanceof QuoteWriteUnavailable) {
            $messages = [
                'QUOTE_WRITE_NOT_PROVISIONED' => 'El guardado de Cotizaciones (RFQ, cotizaciones de proveedor y borradores al cliente) no está habilitado en este equipo (falta la cuenta de escritura: overlay compose.supply-quotewrite.yml y su secreto). No se guardó nada.',
                'QUOTE_WRITE_ACCOUNT_REJECTED' => 'MariaDB rechazó la cuenta de escritura de Cotizaciones (no existe o su contraseña no coincide con el secreto). No se guardó nada.',
            ];
            $code = $e->getMessage();
            return $this->fail(503, $code, $messages[$code] ?? 'No se pudo conectar con MariaDB para guardar. No se guardó nada.');
        }
        $errno = $e instanceof \mysqli_sql_exception ? (int) $e->getCode() : 0;
        if (in_array($errno, [1142, 1143, 1044], true)) {
            return $this->fail(503, 'QUOTE_WRITE_GRANTS_INCOMPLETE', 'A la cuenta de escritura de Cotizaciones le faltan permisos en MariaDB. No se guardó nada.');
        }
        log_message('error', 'SupplyFlow supplier quote write failed: ' . get_class($e) . ' errno ' . $errno);
        return $this->fail(503, 'QUOTE_WRITE_UNAVAILABLE', 'No se pudo completar el guardado. No se confirmaron cambios parciales.');
    }

    public function writeStatus(): ResponseInterface
    {
        if ($denied = $this->authorize()) {
            return $denied;
        }
        if ($this->request->getGet() !== []) {
            return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
        }
        $body = ['enabled' => false, 'code' => 'QUOTE_WRITE_UNAVAILABLE', 'expected_grants' => SupplierQuoteWriteRepository::expectedGrants(), 'missing_grants' => [], 'read_only' => true];
        try {
            $missing = (new SupplierQuoteWriteRepository())->missingGrants();
            $body['missing_grants'] = $missing;
            $body['enabled'] = $missing === [];
            $body['code'] = $missing === [] ? 'OK' : 'QUOTE_WRITE_GRANTS_INCOMPLETE';
        } catch (QuoteWriteUnavailable $e) {
            $body['code'] = $e->getMessage();
        } catch (Throwable) {
            log_message('error', 'SupplyFlow supplier quote write status check failed.');
        }
        return $this->reply(200, $body);
    }

    public function create(): ResponseInterface
    {
        $b = $this->boundary();
        if ($b instanceof ResponseInterface) {
            return $b;
        }
        [$json, $key] = $b;
        try {
            $p = SupplierQuoteInput::payload($json);
            $org = (int) $this->actor['organization_id'];
            $today = (new RequisitionHistoryReadRepository())->businessToday($org);
            $out = (new SupplierQuoteWriteRepository())->create($org, (int) $this->actor['id'], $p, $today, $key);
            return $this->reply($out['replayed'] ? 200 : 201, $out);
        } catch (Throwable $e) {
            return $this->handle($e);
        }
    }

    public function createRfq(): ResponseInterface
    {
        $b = $this->boundary();
        if ($b instanceof ResponseInterface) {
            return $b;
        }
        [$json, $key] = $b;
        try {
            $p = RfqInput::payload($json);
            $out = (new RfqWriteRepository())->create((int) $this->actor['organization_id'], (int) $this->actor['id'], $p, $key);
            return $this->reply($out['replayed'] ? 200 : 201, $out);
        } catch (Throwable $e) {
            return $this->handle($e, 'INVALID_RFQ');
        }
    }

    public function markRfqSent(string $id): ResponseInterface
    {
        $b = $this->boundary();
        if ($b instanceof ResponseInterface) {
            return $b;
        }
        [$json, $key] = $b;
        if (! RfqInput::uuid(strtolower($id))) {
            return $this->fail(404, 'NOT_FOUND', 'RFQ no encontrada.');
        }
        if ($json !== []) {
            return $this->fail(422, 'INVALID_RFQ', 'Revisa los datos capturados.', ['field' => 'body']);
        }
        if (preg_match('/^"([1-9][0-9]{0,8})"$/D', $this->request->getHeaderLine('If-Match'), $m) !== 1) {
            return $this->fail(428, 'IF_MATCH_REQUIRED', 'Se necesita la versión vigente de la RFQ.');
        }
        try {
            return $this->reply(200, (new RfqWriteRepository())->markSent((int) $this->actor['organization_id'], (int) $this->actor['id'], strtolower($id), (int) $m[1], $key));
        } catch (Throwable $e) {
            return $this->handle($e, 'INVALID_RFQ');
        }
    }

    public function createCustomerQuote(): ResponseInterface
    {
        $b = $this->boundary();
        if ($b instanceof ResponseInterface) {
            return $b;
        }
        [$json, $key] = $b;
        try {
            $p = CustomerQuoteInput::payload($json);
            $out = (new CustomerQuoteWriteRepository())->createDraft((int) $this->actor['organization_id'], (int) $this->actor['id'], $p, $key);
            return $this->reply($out['replayed'] ? 200 : 201, $out);
        } catch (Throwable $e) {
            return $this->handle($e, 'INVALID_CUSTOMER_QUOTE');
        }
    }

    public function updateCustomerQuote(string $id): ResponseInterface
    {
        $b = $this->boundary();
        if ($b instanceof ResponseInterface) {
            return $b;
        }
        [$json, $key] = $b;
        if (! CustomerQuoteInput::uuid(strtolower($id))) {
            return $this->fail(404, 'NOT_FOUND', 'Cotización al cliente no encontrada.');
        }
        if (preg_match('/^"([1-9][0-9]{0,8})"$/D', $this->request->getHeaderLine('If-Match'), $m) !== 1) {
            return $this->fail(428, 'IF_MATCH_REQUIRED', 'Se necesita la versión vigente del borrador.');
        }
        try {
            $p = CustomerQuoteInput::payload($json, true);
            return $this->reply(200, (new CustomerQuoteWriteRepository())->updateDraft((int) $this->actor['organization_id'], (int) $this->actor['id'], strtolower($id), (int) $m[1], $p, $key));
        } catch (Throwable $e) {
            return $this->handle($e, 'INVALID_CUSTOMER_QUOTE');
        }
    }

    public function update(string $id): ResponseInterface
    {
        $b = $this->boundary();
        if ($b instanceof ResponseInterface) {
            return $b;
        }
        [$json, $key] = $b;
        if (! SupplierQuoteInput::uuid(strtolower($id))) {
            return $this->fail(404, 'NOT_FOUND', 'Cotización no encontrada.');
        }
        if (preg_match('/^"([1-9][0-9]{0,8})"$/D', $this->request->getHeaderLine('If-Match'), $m) !== 1) {
            return $this->fail(428, 'IF_MATCH_REQUIRED', 'Se necesita la versión vigente de la cotización.');
        }
        try {
            $p = SupplierQuoteInput::payload($json, true);
            return $this->reply(200, (new SupplierQuoteWriteRepository())->update((int) $this->actor['organization_id'], (int) $this->actor['id'], strtolower($id), (int) $m[1], $p, $key));
        } catch (Throwable $e) {
            return $this->handle($e);
        }
    }
}
