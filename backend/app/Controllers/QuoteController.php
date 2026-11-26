<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\QuoteReadRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/** Cotizaciones y Comparativo · read-only. Recording supplier quotes is in SupplierQuoteWriteController; sending RFQs, awarding or recording client decisions is NOT exposed. */
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
    private const PERSON_KEY = '/^(all|unassigned|legacy-[0-9a-f]{16}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/D';

    public function rfqs(): ResponseInterface { return $this->run(self::BASIC + ['contact' => [self::PERSON_KEY, 'all']], fn ($r, $o, $f) => $r->rfqs($o, $f)); }
    /** Tarjeta 3: resumen de RFQ por contacto de compras (solo lectura). */
    /** Tarjeta 6: tipo de cambio registrado y políticas de aprobación vigentes (solo lectura). */
    public function customerQuoteSetup(): ResponseInterface { return $this->run([], fn ($r, $o, $f) => $r->customerQuoteSetup($o), false); }
    public function rfqContacts(): ResponseInterface { return $this->run([], fn ($r, $o, $f) => $r->rfqContacts($o), false); }
    public function rfq(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->rfq($o, $i)); }
    /** Tarjeta 2 (RFQ): catálogos para preparar la solicitud. Solo lectura: guardar/enviar una RFQ sigue bloqueado. */
    public function rfqSetup(): ResponseInterface { return $this->run([], fn ($r, $o, $f) => $r->rfqSetup($o), false); }
    public function rfqRequisitions(): ResponseInterface
    {
        return $this->run(['q' => [self::TEXT, ''], 'buyer' => [self::PERSON_KEY, 'all'], 'rfq' => ['/^(any|with|quoted|quotable)$/D', 'any']], fn ($r, $o, $f) => $r->rfqRequisitions($o, $f));
    }
    public function rfqRequisition(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->rfqRequisition($o, $i)); }
    public function supplierQuotes(): ResponseInterface { return $this->run(self::BASIC, fn ($r, $o, $f) => $r->supplierQuotes($o, $f)); }
    public function supplierQuote(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->supplierQuote($o, $i)); }
    /** Tarjetas 4 y 11: PDF vigente de la cotización del proveedor (uso interno; almacenamiento privado verificado por su huella). */
    public function supplierQuoteDocument(string $id): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== [] || ! preg_match(self::UUID, $id)) {
                return $this->fail(404, 'NOT_FOUND', 'Documento no encontrado.');
            }
            $d = (new QuoteReadRepository())->supplierQuoteDocument((int) $this->actor['organization_id'], $id);
            if (! $d) {
                return $this->fail(404, 'NOT_FOUND', 'La cotización no tiene PDF registrado.');
            }
            if (! $d['available']) {
                return $this->fail(409, 'DOCUMENT_UNAVAILABLE', 'El PDF registrado no está disponible en este equipo o no coincide con su huella.');
            }
            $name = preg_replace('/[\x00-\x1f\x7f]/', '', basename(str_replace('\\', '/', (string) $d['name']))) ?: 'cotizacion.pdf';
            return $this->response->setStatusCode(200)->setHeader('Content-Type', 'application/pdf')->setHeader('Cache-Control', 'private, no-store')
                ->setHeader('X-Content-Type-Options', 'nosniff')->setHeader('Content-Security-Policy', "sandbox; default-src 'none'; frame-ancestors 'self'")
                ->setHeader('Content-Disposition', "attachment; filename=\"cotizacion.pdf\"; filename*=UTF-8''" . rawurlencode($name))
                ->setBody((string) file_get_contents($d['path']));
        } catch (Throwable) {
            log_message('error', 'SupplyFlow supplier quote document unavailable.');
            return $this->fail(503, 'QUOTES_UNAVAILABLE', 'No se pudo consultar el documento.');
        }
    }
    public function comparison(): ResponseInterface { return $this->run(['requisition' => [self::UUID_OR_ALL, 'all']], fn ($r, $o, $f) => $r->comparison($o, $f['requisition']), false); }
    public function customerQuotes(): ResponseInterface
    {
        return $this->run(['q' => [self::TEXT, ''], 'decision' => [self::CODE_OR_ALL, 'all'], 'client' => [self::UUID_OR_ALL, 'all'], 'scope' => ['/^(current|all)$/D', 'current'],
            'status' => ['/^(all|draft|review|authorized|sent|approved|rejected|change_requested|superseded|expired|other)$/D', 'all'],
            'group' => ['/^(all|attention|prep|client|approved|change|rejected)$/D', 'all']], fn ($r, $o, $f) => $r->customerQuotes($o, $f, (int) $this->actor['id']));
    }
    public function customerQuote(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->customerQuote($o, $i)); }
    /** Tarjeta 6: datos internos (costos, gasto y margen) de un borrador registrado en SupplyFlow para seguir editándolo. */
    public function customerQuoteDraft(string $id): ResponseInterface { return $this->one($id, fn ($r, $o, $i) => $r->customerQuoteDraft($o, $i)); }
    /** Revisiones/modificaciones: client-quote families (Rev. 0 → Rev. N). Read-only; R3A eligibility is informative only. */
    public function revisions(): ResponseInterface
    {
        return $this->run(['q' => [self::TEXT, ''], 'status' => ['/^(all|pending|approved|closed)$/D', 'all']], fn ($r, $o, $f) => $r->revisionFamilies($o, (int) $this->actor['id'], $f));
    }
    public function awards(): ResponseInterface { return $this->run(['q' => [self::TEXT, ''], 'status' => ['/^(all|current|[a-z][a-z0-9_\-]{0,31})$/D', 'current']], fn ($r, $o, $f) => $r->awards($o, $f)); }
}
