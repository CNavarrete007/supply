<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\CategoryInput;
use App\Libraries\CategoryWriteRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Requisición › Catálogo de categorías · escritura (Master Admin, cuenta supplyflow_catalogwrite_local):
 * POST   /api/v1/catalogs/categories          alta (Idempotency-Key)
 * PUT    /api/v1/catalogs/categories/{code}   nombre, descripción y estatus (If-Match "versión" + Idempotency-Key)
 * DELETE /api/v1/catalogs/categories/{code}   solo si nunca se usó (If-Match + Idempotency-Key); si tiene uso → 409, desactivarla.
 * Sesión, rol, CSRF, JSON y errores comunes vienen de CatalogWriteController. Sin la cuenta responde 503 sin tocar datos.
 */
final class CategoryWriteController extends CatalogWriteController
{
    protected const INVALID_CODE = 'INVALID_CATEGORY';
    protected const INVALID_MESSAGE = 'Revisa los datos de la categoría.';
    protected const NOT_FOUND_MESSAGE = 'Categoría no encontrada.';
    protected const IF_MATCH_MESSAGE = 'Se necesita la versión vigente de la categoría.';
    protected const NOT_PROVISIONED_MESSAGE = 'El guardado de categorías aún no está habilitado en este equipo (falta aprovisionar la cuenta de escritura del catálogo). No se guardaron cambios.';
    protected const UNAVAILABLE_CODE = 'CATEGORY_WRITE_UNAVAILABLE';
    protected const UNAVAILABLE_MESSAGE = 'No se pudo guardar la categoría. No se confirmaron cambios parciales.';
    private const CATEGORY_VERSION = '/^"([0-9a-f]{16})"$/D';

    protected function parse(mixed $json): array
    {
        return CategoryInput::payload($json);
    }

    protected function repository(): object
    {
        return new CategoryWriteRepository();
    }

    /** Valida sesión, código, clave e If-Match comunes a editar y eliminar. @return array{0:string,1:string}|ResponseInterface */
    private function target(string $code): array|ResponseInterface
    {
        if ($denied = $this->authorize()) {
            return $denied;
        }
        if (! CategoryInput::codeValid($code)) {
            return $this->fail(404, 'NOT_FOUND', static::NOT_FOUND_MESSAGE);
        }
        return [$code, ''];
    }

    public function update(string $code): ResponseInterface
    {
        $t = $this->target($code);
        if ($t instanceof ResponseInterface) {
            return $t;
        }
        $p = $this->input();
        if ($p instanceof ResponseInterface) {
            return $p;
        }
        if (! $key = $this->key()) {
            return $this->fail(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Falta la clave de solicitud.');
        }
        if (! preg_match(self::CATEGORY_VERSION, $this->request->getHeaderLine('If-Match'), $m)) {
            return $this->fail(428, 'IF_MATCH_REQUIRED', static::IF_MATCH_MESSAGE);
        }
        try {
            return $this->reply(200, $this->repository()->update((int) $this->actor['organization_id'], (int) $this->actor['id'], $code, $m[1], $p, $key));
        } catch (Throwable $e) {
            return $this->handle($e);
        }
    }

    public function delete(string $code): ResponseInterface
    {
        $t = $this->target($code);
        if ($t instanceof ResponseInterface) {
            return $t;
        }
        if (! $this->csrfValid()) {
            return $this->fail(403, 'CSRF_INVALID', 'Solicitud no autorizada.');
        }
        if (! $key = $this->key()) {
            return $this->fail(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Falta la clave de solicitud.');
        }
        if (! preg_match(self::CATEGORY_VERSION, $this->request->getHeaderLine('If-Match'), $m)) {
            return $this->fail(428, 'IF_MATCH_REQUIRED', static::IF_MATCH_MESSAGE);
        }
        try {
            return $this->reply(200, $this->repository()->delete((int) $this->actor['organization_id'], (int) $this->actor['id'], $code, $m[1], $key));
        } catch (Throwable $e) {
            return $this->handle($e);
        }
    }

    /** Las categorías no tienen logotipo. */
    public function logo(string $id): ResponseInterface
    {
        return $this->fail(404, 'NOT_FOUND', 'Recurso no encontrado.');
    }
}
