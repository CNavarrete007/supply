<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Shared guard for the read-only operational modules (Órdenes de Compra, Cotizaciones, Recepción, Factura, ...):
 * valid server session + Master Admin role (same rule as the other connected modules), no-store responses and a
 * strict allowlist of query parameters (unknown or non-string parameters → 422). Never performs writes.
 */
abstract class ReadOnlyModuleController extends BaseController
{
    /** @var array<string,mixed> */
    protected array $actor = [];

    protected function respond(int $status, array $body): ResponseInterface
    {
        return $this->response->setStatusCode($status)
            ->setHeader('Cache-Control', 'no-store, private')
            ->setHeader('X-Content-Type-Options', 'nosniff')
            ->setJSON($body);
    }

    protected function fail(int $status, string $code, string $message): ResponseInterface
    {
        return $this->respond($status, ['error' => ['code' => $code, 'message' => $message]]);
    }

    /** Returns a response when access is denied, null when allowed. */
    protected function guard(): ?ResponseInterface
    {
        $actor = (new SupplyAuthRepository())->currentUser($_COOKIE['sf_session'] ?? null);
        if (! $actor) {
            return $this->fail(401, 'NOT_AUTHENTICATED', 'Se requiere iniciar sesión.');
        }
        foreach (($actor['roles'] ?? []) as $role) {
            if (($role['code'] ?? '') === 'master_admin') {
                $this->actor = $actor;
                return null;
            }
        }
        return $this->fail(403, 'FORBIDDEN', 'No tienes acceso a este módulo.');
    }

    /**
     * @param array<string,array{0:string,1:string}> $spec name => [regex, default]; page/page_size are added automatically.
     * @return array<string,mixed>|null Parsed values, or null when anything is invalid or unknown.
     */
    protected function query(array $spec, bool $paged = true): ?array
    {
        $query = $this->request->getGet();
        if (! is_array($query)) {
            return null;
        }
        $allowed = array_keys($spec);
        if ($paged) {
            $allowed = [...$allowed, 'page', 'page_size'];
        }
        if (array_diff(array_keys($query), $allowed) !== []) {
            return null;
        }
        foreach ($query as $value) {
            if (! is_string($value)) {
                return null;
            }
        }
        $out = [];
        foreach ($spec as $name => [$regex, $default]) {
            $value = trim((string) ($query[$name] ?? $default));
            if (mb_strlen($value, 'UTF-8') > 120 || ! preg_match($regex, $value)) {
                return null;
            }
            $out[$name] = $value;
        }
        if ($paged) {
            $page = filter_var($query['page'] ?? '1', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
            $size = filter_var($query['page_size'] ?? '25', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 50]]);
            if ($page === false || $size === false) {
                return null;
            }
            $out['page'] = (int) $page;
            $out['page_size'] = (int) $size;
        }
        return $out;
    }

    protected const UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D';
    protected const UUID_OR_ALL = '/^(all|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/D';
    protected const CODE_OR_ALL = '/^(all|[A-Za-z0-9][A-Za-z0-9_.\- ]{0,63})$/uD';
    protected const TEXT = '/^[^\x00-\x1F\x7F]*$/uD';
}
