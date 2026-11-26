<?php

declare(strict_types=1);

namespace App\Libraries;

use Throwable;

/**
 * Cotizaciones › Cotización formal al cliente (tarjeta 6) · BORRADOR INTERNO con la cuenta quotewrite (26 nov 2026):
 * - Alta: customer_quotes + customer_quote_versions (Rev. 0) + customer_quote_items, folio COT-AAAA-NNNN (serie propia de
 *   las cotizaciones al cliente, como en los datos originales), estatus Borrador. Una por requisición: si ya existe un
 *   borrador de SupplyFlow se edita; si existe otra cotización (importada, enviada o aprobada) no se crea otra.
 * - Edición: solo borradores registrados en SupplyFlow que siguen sin enviar a revisión, autorizar ni enviar (If-Match).
 * El costo de cada partida sale de la adjudicación vigente o de la oferta registrada que eligió la tarjeta (verificadas aquí),
 * y el servidor calcula precio de venta, descuento, IVA, Service Fee y total. El nivel de aprobación se guarda como evaluación
 * informativa. La cuenta NO puede cambiar estatus (no emite, no autoriza, no envía) ni escribir decisiones del cliente u OC.
 */
final class CustomerQuoteWriteRepository extends QuoteWriteBase
{
    public const CALCULATION = 'sf-cq-v1';

    /** Active requisition lines with their current cost source (award, else the chosen registered offer). */
    private function lines(int $org, int $rid, array $p): array
    {
        $active = [];
        foreach ($this->rows("SELECT id,public_id,line_number,description,unit_label FROM requisition_items WHERE organization_id=? AND requisition_id=? AND line_status='active' ORDER BY line_number,id", [$org, $rid]) as $l) {
            $active[$l['public_id']] = $l;
        }
        $sent = array_column($p['lines'], null, 'line_id');
        if (count($sent) !== count($active) || array_diff_key($sent, $active) !== []) {
            throw new QuoteConflict('LINES_CHANGED', 'Las partidas de la requisición cambiaron desde que se abrió. Vuelve a seleccionar la requisición.');
        }
        $out = [];
        foreach ($active as $pub => $l) {
            $s = $sent[$pub];
            $award = $this->one("SELECT aw.id,aw.unit_price,aw.currency_code,s.legal_name,q.folio,qe.public_id AS quote_id FROM awards aw
                JOIN supplier_quotes q ON q.id=aw.supplier_quote_id AND q.organization_id=aw.organization_id JOIN business_entities qe ON qe.id=q.id AND qe.organization_id=q.organization_id
                JOIN suppliers s ON s.id=aw.supplier_id AND s.organization_id=aw.organization_id
                WHERE aw.organization_id=? AND aw.requisition_item_id=? AND aw.status_code='active' AND aw.superseded_at IS NULL ORDER BY aw.id LIMIT 1", [$org, $l['id']]);
            if ($award) {
                if ($s['source'] !== 'award' || $s['quote_id'] !== $award['quote_id']) {
                    throw new QuoteConflict('COST_SOURCE_CHANGED', "Partida {$l['line_number']}: ya tiene adjudicación vigente ({$award['legal_name']}); vuelve a seleccionar la requisición para usar su costo.", 409, 'line:' . $pub);
                }
                $src = ['award_id' => (int) $award['id'], 'cost' => (float) $award['unit_price'], 'cost_text' => (string) $award['unit_price'], 'currency' => $award['currency_code'],
                    'text' => mb_substr("Adjudicación vigente · {$award['legal_name']} ({$award['folio']})", 0, 255)];
            } else {
                $offer = $this->one("SELECT it.unit_price,q.currency_code,s.legal_name,q.folio FROM supplier_quote_items it
                    JOIN supplier_quotes q ON q.id=it.supplier_quote_id AND q.organization_id=it.organization_id JOIN business_entities qe ON qe.id=q.id AND qe.organization_id=q.organization_id
                    JOIN suppliers s ON s.id=q.supplier_id AND s.organization_id=q.organization_id
                    WHERE it.organization_id=? AND it.requisition_item_id=? AND it.offered=1 AND qe.public_id=? ORDER BY it.id LIMIT 1", [$org, $l['id'], $s['quote_id']]);
                if (! $offer || $s['source'] !== 'offer') {
                    throw new QuoteConflict('COST_SOURCE_CHANGED', "Partida {$l['line_number']}: la oferta elegida ya no está registrada para esta partida; vuelve a seleccionar la requisición.", 409, 'line:' . $pub);
                }
                $src = ['award_id' => null, 'cost' => (float) $offer['unit_price'], 'cost_text' => (string) $offer['unit_price'], 'currency' => $offer['currency_code'],
                    'text' => mb_substr("Mejor oferta (sin adjudicar) · {$offer['legal_name']} ({$offer['folio']})", 0, 255)];
            }
            $price = CustomerQuoteInput::priceLine($src['cost'], $src['currency'], $s['qty'], $s['handling'], $s['margin'], $p);
            if ($price === null) {
                throw new QuoteConflict('EXCHANGE_RATE_REQUIRED', "Partida {$l['line_number']}: falta el tipo de cambio de {$src['currency']}.", 422, $src['currency'] === 'EUR' ? 'eur_mxn' : 'usd_mxn');
            }
            if ($price['subtotal'] >= 1e13) {
                throw new \InvalidArgumentException('line:' . $pub); // DECIMAL(20,6): an amount that does not fit is a capture error (422)
            }
            $rf = CustomerQuoteInput::rate2($src['currency'], $p);
            $rt = CustomerQuoteInput::rate2($p['currency'], $p);
            $out[] = ['db' => (int) $l['id'], 'id' => $pub, 'line_number' => (int) $l['line_number'], 'description' => $l['description'], 'unit_label' => $l['unit_label'], 'qty' => $s['qty'],
                'handling' => $s['handling'], 'margin' => $s['margin'], 'brand_model' => $s['brand_model'], 'src' => $src, 'price' => $price,
                'fx' => $src['currency'] === $p['currency'] ? 1.0 : ($rf && $rt ? $rf / $rt : null)];
        }
        return $out;
    }

    /** Enabled, effective client-quote approval policy (same pick as the card) or null. */
    private function policy(int $org): ?array
    {
        foreach ($this->rows('SELECT id,applies_to,version_number,currency_code,unit_price_limit,document_limit,total_basis,comparison_operator FROM approval_policy_versions
            WHERE organization_id=? AND enabled=1 AND (effective_from IS NULL OR effective_from<=CURDATE()) AND (effective_until IS NULL OR effective_until>=CURDATE())
            ORDER BY applies_to,version_number DESC,id DESC', [$org]) as $pol) {
            if (preg_match('/customer|client|cotiz/i', (string) $pol['applies_to'])) {
                return $pol;
            }
        }
        return null;
    }

    /** Informative approval evaluation of the draft (same rule as approvalLevel() of the card). Authorizes nothing. */
    private static function evaluate(?array $pol, array $lines, array $t, array $p): array
    {
        if (! $pol) {
            return ['status' => 'no_policy'];
        }
        $pc = $pol['currency_code'] ?: 'MXN';
        $units = array_map(static fn ($l) => $l['price']['unit'], $lines);
        $maxUnit = $units ? CustomerQuoteInput::convert(max($units), $p['currency'], $pc, $p) : 0.0;
        $evaluated = CustomerQuoteInput::convert(strtolower(trim((string) $pol['total_basis'])) === 'total' ? $t['total'] : $t['subtotal'], $p['currency'], $pc, $p);
        if ($maxUnit === null || $evaluated === null) {
            return ['status' => 'no_rate', 'currency' => $pc];
        }
        $over = static fn (float $v, $lim) => $lim !== null && ($pol['comparison_operator'] === '>=' ? $v >= (float) $lim : $v > (float) $lim);
        $unitOver = $over($maxUnit, $pol['unit_price_limit']);
        $docOver = $over($evaluated, $pol['document_limit']);
        return ['status' => $unitOver || $docOver ? 'exceeds' : 'within', 'level' => $unitOver || $docOver ? null : 1, 'max_unit' => CustomerQuoteInput::r2($maxUnit),
            'evaluated' => CustomerQuoteInput::r2($evaluated), 'unit_over' => $unitOver, 'doc_over' => $docOver, 'currency' => $pc, 'note' => 'Evaluación informativa del borrador; no autoriza la cotización.'];
    }

    private function preparer(int $org, string $public): array
    {
        $u = $this->one("SELECT u.id,u.public_id,p.display_name AS name,p.position_title AS position FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id
            JOIN user_roles ur ON ur.user_id=u.id AND ur.organization_id=u.organization_id JOIN roles ro ON ro.id=ur.role_id AND ro.organization_id=ur.organization_id
            WHERE u.organization_id=? AND u.public_id=? AND u.access_enabled=1 AND u.status_code='active' AND ro.code IN ('buyer','master_admin') LIMIT 1", [$org, $public]);
        if (! $u) {
            throw new QuoteConflict('PREPARER_UNAVAILABLE', 'El comprador que elabora debe ser un usuario activo con rol Comprador o Master Admin.', 422, 'preparer_id');
        }
        return $u;
    }

    /** Next client-quote folio COT-AAAA-NNNN (its own series; revision suffixes -N are ignored), as in the original data. */
    private function nextFolio(int $org, string $issue): string
    {
        $prefix = 'COT-' . substr($issue, 0, 4) . '-';
        $max = 0;
        foreach ($this->rows('SELECT folio FROM customer_quote_versions WHERE organization_id=? AND folio LIKE ?', [$org, $prefix . '%']) as $r) {
            if (preg_match('/^' . preg_quote($prefix, '/') . '(\d{1,9})(?:-\d+)*$/D', (string) $r['folio'], $m)) {
                $max = max($max, (int) $m[1]);
            }
        }
        return $prefix . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    /** Version columns computed from the payload (amounts from the server calculation). */
    private static function versionValues(array $p, array $lines, array $t, array $prep, ?array $pol, array $eval): array
    {
        $fxLabel = 'Moneda ' . $p['currency'] . ($p['usd_mxn'] !== null ? ' · 1 USD = ' . $p['usd_mxn'] . ' MXN' : '') . ($p['eur_mxn'] !== null ? ' · 1 EUR = ' . $p['eur_mxn'] . ' MXN' : '');
        $nul = static fn (string $v) => $v === '' ? null : $v;
        return [
            'quote_date' => $p['issue_date'], 'valid_until' => $p['valid_until'], 'currency_code' => $p['currency'], 'exchange_rate_date' => $p['fx_date'], 'usd_mxn_rate' => $p['usd_mxn'],
            'eur_mxn_rate' => $p['eur_mxn'], 'exchange_rate_source' => $nul($p['fx_source']), 'exchange_rate_label_snapshot' => mb_substr($fxLabel, 0, 500), 'prepared_by' => $prep['id'],
            'people_snapshots' => self::json(['prepared' => $prep['name'], 'preparedId' => $prep['public_id'], 'preparedPosition' => $prep['position'], 'reviewed' => null, 'reviewedId' => null,
                'reviewedPosition' => null, 'approved' => null, 'approvedId' => null, 'approvedPosition' => null, 'peopleRoleOrderVersion' => 1]),
            'delivery_place' => $nul($p['delivery_place']), 'lead_time_text' => $nul($p['lead_time']), 'payment_terms' => $nul($p['payment_terms']), 'warranty_text' => $nul($p['warranty']),
            'inclusions_text' => $nul($p['inclusions']), 'exclusions_text' => $nul($p['exclusions']), 'notes' => $nul($p['notes']),
            'subtotal_amount' => $t['third'], 'discount_kind' => 'percentage', 'discount_rate_pct' => $p['discount'], 'discount_amount' => $t['discount'], 'tax_rate_pct' => $p['vat'],
            'tax_amount' => CustomerQuoteInput::r2($t['tax'] + $t['sfTax']), 'third_party_taxable_amount' => $t['taxable'], 'third_party_tax_amount' => $t['tax'], 'third_party_total_amount' => $t['thirdTotal'],
            'service_fee_enabled' => $p['sf_enabled'] ? 1 : 0, 'service_fee_rate_pct' => $p['sf_pct'], 'service_fee_base_amount' => $t['sfBase'], 'service_fee_unit_price' => $t['sfUnit'],
            'service_fee_subtotal_amount' => $t['sfUnit'], 'service_fee_tax_rate_pct' => $p['vat'], 'service_fee_tax_amount' => $t['sfTax'], 'service_fee_total_amount' => $t['sfTotal'],
            'service_fee_comments' => $nul($p['sf_comments']), 'total_amount' => $t['total'], 'approval_policy_version_id' => $pol['id'] ?? null,
            'approval_policy_snapshot' => $pol ? self::json($pol) : null, 'approval_evaluation_snapshot' => self::json($eval + ['lines' => count($lines)]),
        ];
    }

    private static function itemValues(array $l, array $p): array
    {
        return ['brand_model' => $l['brand_model'] === '' ? null : $l['brand_model'], 'quantity' => $l['qty'], 'cost_amount' => round($l['price']['cost'], 6), 'extra_amount' => $l['handling'],
            'charge_pct' => $l['margin'], 'award_id' => $l['src']['award_id'], 'original_cost_amount' => $l['src']['cost_text'], 'original_cost_currency' => $l['src']['currency'],
            'cost_source_text' => $l['src']['text'], 'exchange_rate' => $l['fx'] === null ? null : round($l['fx'], 10), 'exchange_rate_date' => $p['fx_date'],
            'exchange_rate_source' => $p['fx_source'] === '' ? null : $p['fx_source'], 'unit_price' => $l['price']['unit'], 'line_subtotal' => $l['price']['subtotal']];
    }

    private static function summary(array $p, array $t, array $eval, string $folio): array
    {
        return ['folio' => $folio, 'currency' => $p['currency'], 'issue_date' => $p['issue_date'], 'valid_until' => $p['valid_until'], 'third' => $t['third'], 'discount' => $t['discount'],
            'taxable' => $t['taxable'], 'tax' => $t['tax'], 'service_fee' => $t['sfTotal'], 'total' => $t['total'], 'approval' => $eval['status'] . (isset($eval['level']) && $eval['level'] ? ' (nivel 1)' : '')];
    }

    public function createDraft(int $org, int $actor, array $p, string $key): array
    {
        $endpoint = 'quotes.customer_quote.create';
        $hash = hash('sha256', self::json($p), true);
        $lock = 'supplyflow.quotes.customer.' . $org;
        $this->lock($lock);
        $this->db->begin_transaction();
        try {
            if ($again = $this->claim($org, $actor, $endpoint, $key, $hash)) {
                $this->db->commit();
                return $again;
            }
            $req = $this->one("SELECT r.id,r.folio,r.client_id,re.archived_at,ce.public_id AS client_public FROM requisitions r JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id AND re.entity_kind='requisition'
                JOIN business_entities ce ON ce.id=r.client_id AND ce.organization_id=r.organization_id WHERE r.organization_id=? AND re.public_id=?", [$org, $p['requisition_id']]);
            if (! $req) {
                throw new QuoteConflict('NOT_FOUND', 'Requisición no encontrada.', 404);
            }
            if ($req['archived_at'] !== null) {
                throw new QuoteConflict('REQUISITION_ARCHIVED', "La requisición {$req['folio']} está archivada.");
            }
            $rid = (int) $req['id'];
            $prior = $this->one("SELECT v.folio,ve.public_id AS id,v.document_status,v.internal_approval_status,v.client_decision_status,COALESCE(v.legacy_status,v.document_status) AS status,
                (ve.imported_at IS NOT NULL OR ve.legacy_id IS NOT NULL) AS imported,COALESCE(v.legacy_revision_number,v.version_number-1) AS revision
                FROM customer_quote_versions v JOIN business_entities ve ON ve.id=v.id AND ve.organization_id=v.organization_id
                WHERE v.organization_id=? AND v.requisition_id=? ORDER BY v.version_number DESC,v.id DESC LIMIT 1", [$org, $rid]);
            if ($prior) {
                $draft = ! (int) $prior['imported'] && $prior['document_status'] === 'draft' && $prior['internal_approval_status'] === 'not_requested' && $prior['client_decision_status'] === 'not_recorded';
                throw $draft
                    ? new QuoteConflict('DRAFT_EXISTS', "La requisición {$req['folio']} ya tiene el borrador {$prior['folio']}: ábrelo de nuevo en la tarjeta para editarlo.", 409, 'requisition_id')
                    : new QuoteConflict('CUSTOMER_QUOTE_EXISTS', "La requisición {$req['folio']} ya tiene la cotización {$prior['folio']} (Rev. {$prior['revision']} · {$prior['status']}). No se crea otra: una nueva revisión se origina con «Solicitar modificación» (tarjetas 1 u 8).", 409, 'requisition_id');
            }
            $this->currency($p['currency']);
            $prep = $this->preparer($org, $p['preparer_id']);
            $lines = $this->lines($org, $rid, $p);
            $t = CustomerQuoteInput::totals(array_map(static fn ($l) => $l['price']['subtotal'], $lines), $p);
            if ($t['total'] >= 1e14) {
                throw new \InvalidArgumentException('lines');
            }
            $pol = $this->policy($org);
            $eval = self::evaluate($pol, $lines, $t, $p);
            $folio = $this->nextFolio($org, $p['issue_date']);
            $now = gmdate('Y-m-d H:i:s');
            $entity = fn (string $kind) => [$this->insert('business_entities', ['organization_id' => $org, 'public_id' => $pub = self::uuid(), 'entity_kind' => $kind, 'created_at' => $now, 'updated_at' => $now,
                'created_by' => $actor, 'updated_by' => $actor, 'row_version' => 1]), $pub];
            [$cqId] = $entity('customer_quote');
            $this->insert('customer_quotes', ['id' => $cqId, 'organization_id' => $org, 'requisition_id' => $rid, 'client_id' => $req['client_id'], 'series_reference' => 'sf:' . $folio, 'migration_grouping_status' => 'not_applicable']);
            [$vId, $vPub] = $entity('customer_quote_version');
            $this->insert('customer_quote_versions', ['id' => $vId, 'organization_id' => $org, 'customer_quote_id' => $cqId, 'requisition_id' => $rid, 'version_number' => 1, 'folio' => $folio,
                'document_status' => 'draft', 'internal_approval_status' => 'not_requested', 'client_decision_status' => 'not_recorded', 'legacy_status' => 'Borrador',
                'client_snapshot' => self::json(['clientId' => $req['client_public']]), 'financial_breakdown_provenance' => 'calculated', 'calculation_version' => self::CALCULATION,
                'reconciliation_status' => 'not_required'] + self::versionValues($p, $lines, $t, $prep, $pol, $eval));
            foreach ($lines as $l) {
                $this->insert('customer_quote_items', ['organization_id' => $org, 'requisition_id' => $rid, 'customer_quote_version_id' => $vId, 'requisition_item_id' => $l['db'], 'line_number' => $l['line_number'],
                    'resolution_status' => 'resolved', 'description' => $l['description'], 'unit_label' => $l['unit_label'], 'pricing_formula_code' => self::CALCULATION, 'cost_is_manual' => 0] + self::itemValues($l, $p));
            }
            $sum = self::summary($p, $t, $eval, $folio);
            $this->event($org, $rid, $actor, 'customer_quote', 'cq.draft_saved', 'draft', ['customer_quote' => $vPub, 'requisition' => $req['folio'], 'lines' => count($lines)] + $sum,
                "Borrador de cotización al cliente {$folio} (Rev. 0) guardado: total {$t['total']} {$p['currency']}.");
            $this->audit($org, $vId, $actor, 'customer_quote.draft_create', ['requisition' => $req['folio'], 'after' => $sum, 'lines' => array_map(static fn ($l) => ['line' => $l['line_number'], 'cost' => $l['src']['text'],
                'qty' => $l['qty'], 'handling' => $l['handling'], 'margin' => $l['margin'], 'unit' => $l['price']['unit']], $lines)]);
            $out = ['id' => $vPub, 'folio' => $folio, 'revision' => 0, 'status' => 'Borrador', 'requisition' => $req['folio'], 'requisition_id' => $p['requisition_id'], 'currency' => $p['currency'],
                'total' => $t['total'], 'lines' => count($lines), 'approval' => $eval['status'], 'version' => 1, 'replayed' => false];
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

    public function updateDraft(int $org, int $actor, string $public, int $version, array $p, string $key): array
    {
        $endpoint = 'quotes.customer_quote.update:' . $public;
        $hash = hash('sha256', self::json($p + ['_version' => $version]), true);
        $lock = 'supplyflow.quotes.customer.' . $org;
        $this->lock($lock);
        $this->db->begin_transaction();
        try {
            if ($again = $this->claim($org, $actor, $endpoint, $key, $hash)) {
                $this->db->commit();
                return $again;
            }
            $v = $this->one("SELECT v.*,ve.row_version,ve.imported_at,ve.legacy_id,r.folio AS requisition FROM customer_quote_versions v
                JOIN business_entities ve ON ve.id=v.id AND ve.organization_id=v.organization_id AND ve.entity_kind='customer_quote_version'
                JOIN requisitions r ON r.id=v.requisition_id AND r.organization_id=v.organization_id
                WHERE v.organization_id=? AND ve.public_id=? AND ve.archived_at IS NULL", [$org, $public]);
            if (! $v) {
                throw new QuoteConflict('NOT_FOUND', 'Cotización al cliente no encontrada.', 404);
            }
            if ($v['imported_at'] !== null || $v['legacy_id'] !== null) {
                throw new QuoteConflict('IMPORTED_READ_ONLY', "{$v['folio']} es una cotización importada del sistema original: se conserva como expediente.");
            }
            if ($v['document_status'] !== 'draft' || $v['internal_approval_status'] !== 'not_requested' || $v['client_decision_status'] !== 'not_recorded') {
                throw new QuoteConflict('NOT_A_DRAFT', "{$v['folio']} ya no es un borrador interno y no se edita aquí.");
            }
            if ((int) $v['row_version'] !== $version) {
                throw new QuoteStale('El borrador cambió desde que se abrió. Vuelve a seleccionar la requisición.');
            }
            $this->currency($p['currency']);
            $prep = $this->preparer($org, $p['preparer_id']);
            $lines = $this->lines($org, (int) $v['requisition_id'], $p);
            $items = [];
            foreach ($this->rows('SELECT id,requisition_item_id FROM customer_quote_items WHERE organization_id=? AND customer_quote_version_id=?', [$org, $v['id']]) as $i) {
                $items[(int) $i['requisition_item_id']] = (int) $i['id'];
            }
            if (count($items) !== count($lines) || array_diff(array_map(static fn ($l) => $l['db'], $lines), array_keys($items)) !== []) {
                throw new QuoteConflict('LINES_CHANGED', 'Las partidas de la requisición cambiaron desde que se guardó el borrador.');
            }
            $t = CustomerQuoteInput::totals(array_map(static fn ($l) => $l['price']['subtotal'], $lines), $p);
            if ($t['total'] >= 1e14) {
                throw new \InvalidArgumentException('lines');
            }
            $pol = $this->policy($org);
            $eval = self::evaluate($pol, $lines, $t, $p);
            $vals = self::versionValues($p, $lines, $t, $prep, $pol, $eval);
            $before = ['total' => (float) $v['total_amount'], 'currency' => $v['currency_code'], 'valid_until' => $v['valid_until']];
            $this->exec('UPDATE customer_quote_versions SET `' . implode('`=?,`', array_keys($vals)) . '`=? WHERE organization_id=? AND id=?', [...array_values($vals), $org, $v['id']]);
            foreach ($lines as $l) {
                $iv = self::itemValues($l, $p);
                $this->exec('UPDATE customer_quote_items SET `' . implode('`=?,`', array_keys($iv)) . '`=? WHERE organization_id=? AND id=? AND customer_quote_version_id=?', [...array_values($iv), $org, $items[$l['db']], $v['id']]);
            }
            if ($this->exec('UPDATE business_entities SET row_version=row_version+1,updated_at=UTC_TIMESTAMP(6),updated_by=? WHERE organization_id=? AND id=? AND row_version=?', [$actor, $org, $v['id'], $version]) !== 1) {
                throw new QuoteStale('El borrador cambió desde que se abrió. Vuelve a seleccionar la requisición.');
            }
            $sum = self::summary($p, $t, $eval, (string) $v['folio']);
            $this->event($org, (int) $v['requisition_id'], $actor, 'customer_quote', 'cq.draft_updated', 'draft', ['customer_quote' => $public, 'requisition' => $v['requisition'], 'before' => $before] + $sum,
                "Borrador de cotización al cliente {$v['folio']} actualizado: total {$t['total']} {$p['currency']}.");
            $this->audit($org, (int) $v['id'], $actor, 'customer_quote.draft_update', ['requisition' => $v['requisition'], 'before' => $before, 'after' => $sum]);
            $out = ['id' => $public, 'folio' => $v['folio'], 'revision' => (int) ($v['legacy_revision_number'] ?? ((int) $v['version_number'] - 1)), 'status' => 'Borrador', 'currency' => $p['currency'],
                'total' => $t['total'], 'lines' => count($lines), 'approval' => $eval['status'], 'version' => $version + 1, 'replayed' => false];
            $this->finish($org, $actor, $endpoint, $key, 200, $out);
            $this->db->commit();
            return $out;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        } finally {
            $this->unlock($lock);
        }
    }
}
