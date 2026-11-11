<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\InvoiceReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/** Factura · read-only. Registering, editing, cancelling or deleting invoices and downloading files is NOT exposed. */
final class InvoiceController extends ReadOnlyModuleController
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
            return $this->respond(200, $fn(new InvoiceReadRepository(), (int) $this->actor['organization_id'], $f));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow invoices unavailable.');
            return $this->fail(503, 'INVOICES_UNAVAILABLE', 'No se pudo consultar Factura.');
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
            $r = $fn(new InvoiceReadRepository(), (int) $this->actor['organization_id'], $id);
            return $r ? $this->respond(200, $r) : $this->fail(404, 'NOT_FOUND', 'Registro no encontrado.');
        } catch (Throwable) {
            log_message('error', 'SupplyFlow invoice detail unavailable.');
            return $this->fail(503, 'INVOICES_UNAVAILABLE', 'No se pudo consultar el registro.');
        }
    }

    public function index(): ResponseInterface
    {
        return $this->run(['q' => [self::TEXT, ''], 'client' => [self::UUID_OR_ALL, 'all'], 'state' => ['/^(all|active|pending|overdue|paid|cancelled)$/D', 'all']], fn ($r, $o, $f) => $r->list($o, $f));
    }
    public function show(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->show($o, $i)); }
    public function requisitions(): ResponseInterface { return $this->run([], fn ($r, $o) => $r->requisitions($o), false); }
    public function requisition(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->context($o, $i)); }
    public function control(): ResponseInterface { return $this->run([], fn ($r, $o) => $r->control($o), false); }
}
