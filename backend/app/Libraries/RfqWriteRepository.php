<?php

declare(strict_types=1);

namespace App\Libraries;

use Throwable;

/**
 * Cotizaciones › Solicitud a proveedores (RFQ, tarjeta 2) · registro de la RFQ con la cuenta quotewrite (26 nov 2026):
 * - Alta: rfqs + rfq_items con folio RFQ-AAAA-NNNN (año de la emisión), proveedor invitado, contacto de compras, fechas,
 *   moneda, documentación y condiciones, y las partidas elegidas de la requisición (numeradas 1..n, como en los datos
 *   originales). Estatus Borrador o Enviada. Exige que la validación vigente del contratista permita cotizar.
 * - Marcar enviada: un Borrador registrado en SupplyFlow pasa a Enviada (If-Match). Las importadas no se modifican.
 * SupplyFlow NO envía correos: el comprador manda el formato desde su propio correo. No modifica partidas, cotizaciones,
 * adjudicaciones ni OC. Cada escritura: transacción, Idempotency-Key, evento de flujo y bitácora (módulo quotes).
 */
final class RfqWriteRepository extends QuoteWriteBase
{
    private const NOT_INVITABLE = ['suspended', 'inactive', 'blocked'];
    private const DRAFT = ['borrador', 'draft'];

    /** Next folio RFQ-AAAA-NNNN of the issue year (max + 1, same rule as the preview; the unique key protects it). */
    private function nextFolio(int $org, string $issue): string
    {
        $prefix = 'RFQ-' . substr($issue, 0, 4) . '-';
        $max = 0;
        foreach ($this->rows('SELECT folio FROM rfqs WHERE organization_id=? AND folio LIKE ?', [$org, $prefix . '%']) as $r) {
            $tail = substr((string) $r['folio'], strlen($prefix));
            if (ctype_digit($tail) && strlen($tail) <= 9) {
                $max = max($max, (int) $tail);
            }
        }
        return $prefix . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    public function create(int $org, int $actor, array $p, string $key): array
    {
        $endpoint = 'quotes.rfq.create';
        $hash = hash('sha256', self::json($p), true);
        $lock = 'supplyflow.quotes.rfq.' . $org;
        $this->lock($lock);
        $this->db->begin_transaction();
        try {
            if ($again = $this->claim($org, $actor, $endpoint, $key, $hash)) {
                $this->db->commit();
                return $again;
            }
            $req = $this->one("SELECT r.id,r.folio,re.archived_at FROM requisitions r JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id AND re.entity_kind='requisition'
                WHERE r.organization_id=? AND re.public_id=?", [$org, $p['requisition_id']]);
            if (! $req) {
                throw new QuoteConflict('NOT_FOUND', 'Requisición no encontrada.', 404);
            }
            if ($req['archived_at'] !== null) {
                throw new QuoteConflict('REQUISITION_ARCHIVED', "La requisición {$req['folio']} está archivada.");
            }
            $rid = (int) $req['id'];
            $rv = $this->one('SELECT folio,technical_result,contract_result,budget_result FROM requisition_reviews WHERE organization_id=? AND requisition_id=? ORDER BY id DESC LIMIT 1', [$org, $rid]);
            if (! $rv) {
                throw new QuoteConflict('REVIEW_REQUIRED', "La requisición {$req['folio']} no tiene validación interna: regístrala en Gestión del Contratista.");
            }
            if (! ContractorMgmtInput::canQuote((string) $rv['technical_result'], (string) $rv['contract_result'], (string) $rv['budget_result'])) {
                throw new QuoteConflict('REVIEW_BLOCKS_QUOTING', "La validación vigente {$rv['folio']} no permite pasar a cotización: actualízala en Gestión del Contratista antes de emitir la RFQ.");
            }
            $sup = $this->one("SELECT s.id,s.legal_name,s.status_code FROM suppliers s JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id
                WHERE s.organization_id=? AND se.public_id=? AND se.archived_at IS NULL", [$org, $p['supplier_id']]);
            if (! $sup) {
                throw new QuoteConflict('SUPPLIER_UNAVAILABLE', 'El proveedor ya no existe en el catálogo.', 422, 'supplier_id');
            }
            if (in_array($sup['status_code'], self::NOT_INVITABLE, true)) {
                throw new QuoteConflict('SUPPLIER_NOT_INVITABLE', "{$sup['legal_name']} está suspendido o inactivo: no puede invitarse.", 422, 'supplier_id');
            }
            $contact = $this->one("SELECT u.id,p.display_name AS name,p.email,p.phone FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id
                JOIN user_roles ur ON ur.user_id=u.id AND ur.organization_id=u.organization_id JOIN roles ro ON ro.id=ur.role_id AND ro.organization_id=ur.organization_id
                WHERE u.organization_id=? AND u.public_id=? AND u.access_enabled=1 AND u.status_code='active' AND ro.code IN ('buyer','master_admin') LIMIT 1", [$org, $p['contact_id']]);
            if (! $contact) {
                throw new QuoteConflict('CONTACT_UNAVAILABLE', 'El contacto de compras debe ser un usuario activo con rol Comprador o Master Admin.', 422, 'contact_id');
            }
            $this->currency($p['currency']);
            $lines = [];
            foreach ($this->rows("SELECT id,public_id,line_number,description,category_label_snapshot AS category,unit_label,quantity FROM requisition_items
                WHERE organization_id=? AND requisition_id=? AND line_status='active' ORDER BY line_number,id", [$org, $rid]) as $l) {
                $lines[$l['public_id']] = $l;
            }
            if (array_diff($p['items'], array_keys($lines)) !== []) {
                throw new QuoteConflict('LINES_CHANGED', 'Alguna partida elegida ya no está vigente en la requisición. Vuelve a abrir la requisición.');
            }
            [$status, $label] = RfqInput::STATUS[$p['status']];
            $folio = $this->nextFolio($org, $p['issue_date']);
            $public = self::uuid();
            $now = gmdate('Y-m-d H:i:s');
            $id = $this->insert('business_entities', ['organization_id' => $org, 'public_id' => $public, 'entity_kind' => 'rfq', 'created_at' => $now, 'updated_at' => $now,
                'created_by' => $actor, 'updated_by' => $actor, 'row_version' => 1]);
            $snapshot = ['contactName' => $contact['name'], 'contactEmail' => $contact['email'], 'contactPhone' => $contact['phone']];
            $this->insert('rfqs', ['id' => $id, 'organization_id' => $org, 'requisition_id' => $rid, 'supplier_id' => $sup['id'], 'sourcing_lot_id' => null, 'internal_contact_user_id' => $contact['id'],
                'contact_snapshot' => self::json($snapshot), 'folio' => $folio, 'request_date' => $p['issue_date'], 'deadline' => $p['deadline'], 'required_date' => $p['required_date'],
                'currency_code' => $p['currency'], 'delivery_place' => $p['delivery_place'] === '' ? null : $p['delivery_place'], 'requested_documents_text' => $p['docs'] === '' ? null : $p['docs'],
                'terms_text' => $p['conditions'] === '' ? null : $p['conditions'], 'status_code' => $status, 'legacy_status' => $label]);
            // Lines in the requisition order, numbered 1..n within the RFQ (as in the original data).
            $chosen = array_values(array_filter($lines, static fn ($l) => in_array($l['public_id'], $p['items'], true)));
            $n = 0;
            foreach ($chosen as $l) {
                $this->insert('rfq_items', ['organization_id' => $org, 'requisition_id' => $rid, 'rfq_id' => $id, 'requisition_item_id' => $l['id'], 'line_number' => ++$n,
                    'resolution_status' => 'resolved', 'description' => $l['description'], 'specification' => null, 'category_snapshot' => $l['category'], 'unit_label' => $l['unit_label'], 'quantity' => $l['quantity']]);
            }
            $view = ['folio' => $folio, 'requisition' => $req['folio'], 'supplier' => $sup['legal_name'], 'contact' => $contact['name'], 'issue_date' => $p['issue_date'], 'deadline' => $p['deadline'],
                'required_date' => $p['required_date'], 'currency' => $p['currency'], 'status' => $label, 'lines' => array_map(static fn ($l) => (int) $l['line_number'], $chosen)];
            $this->event($org, $rid, $actor, 'rfq', 'rfq.recorded', $status, ['rfq' => $public, 'review' => $rv['folio']] + $view,
                "RFQ {$folio} a {$sup['legal_name']} registrada ({$label}, " . count($chosen) . ' partida(s)).');
            $this->audit($org, $id, $actor, 'rfq.create', ['after' => $view, 'review' => $rv['folio']]);
            $out = ['id' => $public, 'folio' => $folio, 'status' => $status, 'status_label' => $label, 'requisition' => $req['folio'], 'requisition_id' => $p['requisition_id'],
                'supplier_name' => $sup['legal_name'], 'items' => count($chosen), 'version' => 1, 'replayed' => false];
            $this->finish($org, $actor, $endpoint, $key, 201, $out);
            $this->db->commit();
            return $out;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        } finally {
            $this->unlock($lock);
        }
    }

    /** Borrador → Enviada for an RFQ registered in SupplyFlow (the buyer sent it from their own e-mail). */
    public function markSent(int $org, int $actor, string $public, int $version, string $key): array
    {
        $endpoint = 'quotes.rfq.mark_sent:' . $public;
        $hash = hash('sha256', self::json(['_version' => $version]), true);
        $this->db->begin_transaction();
        try {
            if ($again = $this->claim($org, $actor, $endpoint, $key, $hash)) {
                $this->db->commit();
                return $again;
            }
            $f = $this->one("SELECT f.id,f.folio,f.status_code,f.legacy_status,f.requisition_id,e.row_version,e.imported_at,e.legacy_id,s.legal_name AS supplier,r.folio AS requisition
                FROM rfqs f JOIN business_entities e ON e.id=f.id AND e.organization_id=f.organization_id AND e.entity_kind='rfq'
                JOIN suppliers s ON s.id=f.supplier_id AND s.organization_id=f.organization_id JOIN requisitions r ON r.id=f.requisition_id AND r.organization_id=f.organization_id
                WHERE f.organization_id=? AND e.public_id=? AND e.archived_at IS NULL", [$org, $public]);
            if (! $f) {
                throw new QuoteConflict('NOT_FOUND', 'RFQ no encontrada.', 404);
            }
            if ($f['imported_at'] !== null || $f['legacy_id'] !== null) {
                throw new QuoteConflict('IMPORTED_READ_ONLY', "{$f['folio']} es una RFQ importada del sistema original: se conserva como expediente y no se modifica.");
            }
            if (! in_array(mb_strtolower((string) $f['status_code']), self::DRAFT, true)) {
                throw new QuoteConflict('RFQ_NOT_DRAFT', "{$f['folio']} ya no está en Borrador (estatus «" . ($f['legacy_status'] ?: $f['status_code']) . '»).');
            }
            if ((int) $f['row_version'] !== $version) {
                throw new QuoteStale('La RFQ cambió desde que se abrió. Actualiza la matriz de RFQ.');
            }
            $this->exec("UPDATE rfqs SET status_code='enviada',legacy_status='Enviada' WHERE organization_id=? AND id=?", [$org, $f['id']]);
            if ($this->exec('UPDATE business_entities SET row_version=row_version+1,updated_at=UTC_TIMESTAMP(6),updated_by=? WHERE organization_id=? AND id=? AND row_version=?', [$actor, $org, $f['id'], $version]) !== 1) {
                throw new QuoteStale('La RFQ cambió desde que se abrió. Actualiza la matriz de RFQ.');
            }
            $this->event($org, (int) $f['requisition_id'], $actor, 'rfq', 'rfq.sent', 'enviada', ['rfq' => $public, 'folio' => $f['folio'], 'supplier' => $f['supplier'], 'from' => $f['legacy_status'] ?: $f['status_code']],
                "RFQ {$f['folio']} a {$f['supplier']} marcada como enviada.");
            $this->audit($org, (int) $f['id'], $actor, 'rfq.mark_sent', ['folio' => $f['folio'], 'requisition' => $f['requisition'], 'before' => $f['legacy_status'] ?: $f['status_code'], 'after' => 'Enviada']);
            $out = ['id' => $public, 'folio' => $f['folio'], 'status' => 'enviada', 'status_label' => 'Enviada', 'version' => $version + 1, 'replayed' => false];
            $this->finish($org, $actor, $endpoint, $key, 200, $out);
            $this->db->commit();
            return $out;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }
}
