<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\QuoteReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/** Cotizaciones y Comparativo · read-only. Sending RFQs, capturing quotes, awarding or recording decisions is NOT exposed. */
final class QuoteController extends ReadOnlyModuleController
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
            return $this->respond(200, $fn(new QuoteReadRepository(), (int) $this->actor['organization_id'], $f));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow quotes unavailable.');
            return $this->fail(503, 'QUOTES_UNAVAILABLE', 'No se pudo consultar Cotizaciones.');
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
            $r = $fn(new QuoteReadRepository(), (int) $this->actor['organization_id'], $id);
            return $r ? $this->respond(200, $r) : $this->fail(404, 'NOT_FOUND', 'Registro no encontrado.');
        } catch (Throwable) {
            log_message('error', 'SupplyFlow quote detail unavailable.');
            return $this->fail(503, 'QUOTES_UNAVAILABLE', 'No se pudo consultar el registro.');
        }
    }

    private const BASIC = ['q' => [self::TEXT, ''], 'status' => [self::CODE_OR_ALL, 'all'], 'supplier' => [self::UUID_OR_ALL, 'all']];

    public function rfqs(): ResponseInterface { return $this->run(self::BASIC, fn ($r, $o, $f) => $r->rfqs($o, $f)); }
    public function rfq(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->rfq($o, $i)); }
    public function supplierQuotes(): ResponseInterface { return $this->run(self::BASIC, fn ($r, $o, $f) => $r->supplierQuotes($o, $f)); }
    public function supplierQuote(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->supplierQuote($o, $i)); }
    public function comparison(): ResponseInterface { return $this->run(['requisition' => [self::UUID_OR_ALL, 'all']], fn ($r, $o, $f) => $r->comparison($o, $f['requisition']), false); }
    public function customerQuotes(): ResponseInterface
    {
        return $this->run(['q' => [self::TEXT, ''], 'decision' => [self::CODE_OR_ALL, 'all'], 'client' => [self::UUID_OR_ALL, 'all'], 'scope' => ['/^(current|all)$/D', 'current']], fn ($r, $o, $f) => $r->customerQuotes($o, $f));
    }
    public function customerQuote(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->customerQuote($o, $i)); }
    public function awards(): ResponseInterface { return $this->run(['q' => [self::TEXT, ''], 'status' => ['/^(all|current|[a-z][a-z0-9_\-]{0,31})$/D', 'current']], fn ($r, $o, $f) => $r->awards($o, $f)); }
}
