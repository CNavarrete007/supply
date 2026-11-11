<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ReceptionReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/** Recepción y Entrega · read-only. Registering receipts, deliveries, signatures or evidence is NOT exposed. */
final class ReceptionController extends ReadOnlyModuleController
{
    private function run(array $spec, callable $fn, bool $paged = true): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            $f = $this->query($spec, $paged);
            if ($f === null) {
                return $this->fail(422, 'INVALID_FILTER', 'Parámetros de consulta inválidos.');
            }
            return $this->respond(200, $fn(new ReceptionReadRepository(), (int) $this->actor['organization_id'], $f));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow reception unavailable.');
            return $this->fail(503, 'RECEPTION_UNAVAILABLE', 'No se pudo consultar Recepción y Entrega.');
        }
    }

    private function one(string $id, callable $fn): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== []) {
                return $this->fail(422, 'INVALID_FILTER', 'Este recurso no acepta parámetros.');
            }
            if (! preg_match(self::UUID, $id)) {
                return $this->fail(404, 'NOT_FOUND', 'Registro no encontrado.');
            }
            $r = $fn(new ReceptionReadRepository(), (int) $this->actor['organization_id'], $id);
            return $r ? $this->respond(200, $r) : $this->fail(404, 'NOT_FOUND', 'Registro no encontrado.');
        } catch (Throwable) {
            log_message('error', 'SupplyFlow reception detail unavailable.');
            return $this->fail(503, 'RECEPTION_UNAVAILABLE', 'No se pudo consultar el registro.');
        }
    }

    public function matrix(): ResponseInterface
    {
        return $this->run(['q' => [self::TEXT, ''], 'client' => [self::UUID_OR_ALL, 'all'], 'kind' => ['/^(all|receipt|delivery)$/D', 'all']], fn ($r, $o, $f) => $r->matrix($o, $f));
    }
    public function orders(): ResponseInterface
    {
        return $this->run(['q' => [self::TEXT, ''], 'status' => ['/^(all|pending|partial|complete)$/D', 'all']], fn ($r, $o, $f) => $r->orders($o, $f));
    }
    public function order(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->order($o, $i)); }
    public function receipt(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->receipt($o, $i)); }
    public function delivery(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->delivery($o, $i)); }
    public function closure(): ResponseInterface { return $this->run([], fn ($r, $o) => $r->closure($o), false); }
}
