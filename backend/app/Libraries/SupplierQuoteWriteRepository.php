<?php

declare(strict_types=1);

namespace App\Libraries;

use RuntimeException;
use Throwable;

/**
 * Cotizaciones › Registro de cotización (tarjeta 4) · registro interno de la cotización que envió un proveedor contra una RFQ
 * existente, con la cuenta SQL dedicada supplyflow_quotewrite_local (mínimo privilegio, 26 nov 2026):
 * - Alta: supplier_quotes + supplier_quote_items (folio COT-AAAA-NNNN, estatus «Recibida»), importes calculados en el servidor y
 *   PDF privado opcional (files + entity_files, almacenamiento supplyflow_quote_private_v1 fuera del sitio público).
 * - Edición: solo cotizaciones registradas en SupplyFlow, sin adjudicación vigente y en estatus «Recibida» (If-Match = versión).
 *   Las importadas del sistema original se conservan como expediente.
 * No modifica RFQ, no adjudica, no crea cotizaciones al cliente ni OC. Cada escritura: transacción, Idempotency-Key, control de
 * versión, evento de flujo (workflow_events) y bitácora (audit_events, módulo quotes). Infraestructura común: QuoteWriteBase.
 */
final class SupplierQuoteWriteRepository extends QuoteWriteBase
{
    public const STORAGE = 'supplyflow_quote_private_v1';
    public const STATUS = 'recibida';
    public const STATUS_LABEL = 'Recibida';
    public const CALCULATION = 'sf-quote-v1';
    /** RFQ that were not sent to the supplier (or were cancelled) cannot receive a quote. */
    private const RFQ_NOT_SENT = ['borrador', 'draft', 'cancelada', 'cancelled', 'canceled', 'anulada'];

    /** Next folio COT-AAAA-NNNN of the business year (max + 1; the unique key of the folio protects it). */
    private function nextFolio(int $org, string $today): string
    {
        $prefix = 'COT-' . substr($today, 0, 4) . '-';
        $max = 0;
        foreach ($this->rows('SELECT folio FROM supplier_quotes WHERE organization_id=? AND folio LIKE ?', [$org, $prefix . '%']) as $r) {
            $tail = substr((string) $r['folio'], strlen($prefix));
            if (ctype_digit($tail)) {
                $max = max($max, (int) $tail);
            }
        }
        return $prefix . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    /** Lines sent must be exactly the lines of the RFQ (by line number). */
    private static function sameLines(array $sent, array $have): void
    {
        $a = array_column($sent, 'line_number');
        $b = array_map('intval', array_keys($have));
        sort($a);
        sort($b);
        if ($a !== $b) {
            throw new QuoteConflict('LINES_CHANGED', 'Las partidas de la RFQ no coinciden con las capturadas. Vuelve a abrir la RFQ.');
        }
    }

    private static function view(array $p, array $amounts): array
    {
        return ['supplier_reference' => $p['supplier_reference'] === '' ? null : $p['supplier_reference'], 'quote_date' => $p['quote_date'], 'valid_until' => $p['valid_until'], 'currency' => $p['currency'],
            'vat' => self::dec($p['vat']), 'lead_days' => $p['lead_days'], 'payment' => $p['payment'], 'technical' => self::dec($p['technical']), 'documentation' => self::dec($p['documentation']),
            'notes' => $p['notes'] === '' ? null : $p['notes'], 'subtotal' => $amounts['subtotal'], 'tax' => $amounts['tax'], 'total' => $amounts['total']];
    }

    /** Stores the PDF privately (content-addressed) or reuses the same file already registered, and links it to the quote. */
    private function document(int $org, int $actor, int $entity, int $version, array $doc): array
    {
        $file = $this->one('SELECT id,public_id,scan_status,storage_backend FROM files WHERE organization_id=? AND sha256=? AND size_bytes=?', [$org, hex2bin($doc['sha256']), $doc['size']]);
        if ($file && $file['scan_status'] === 'quarantined') {
            throw new QuoteConflict('DOCUMENT_QUARANTINED', 'Ese PDF está en cuarentena y no puede adjuntarse.', 422, 'document');
        }
        if ($file && ! in_array($file['storage_backend'], [self::STORAGE, 'supplyflow_rf1_private', 'supplyflow_local_private_v1'], true)) {
            throw new QuoteConflict('FILE_STORAGE_UNKNOWN', 'Ese PDF ya está registrado en un almacenamiento que requiere conciliación.', 422, 'document');
        }
        if (! $file || $file['storage_backend'] === self::STORAGE) {
            $key = $org . '/' . $doc['sha256'];
            $path = $this->root . '/' . $key;
            if (! is_file($path) || filesize($path) !== $doc['size'] || ! hash_equals($doc['sha256'], (string) hash_file('sha256', $path))) {
                $dir = dirname($path);
                if (! is_dir($dir) && ! mkdir($dir, 0750, true) && ! is_dir($dir)) {
                    throw new RuntimeException('QUOTE_STORAGE_UNAVAILABLE');
                }
                $tmp = $dir . '/.' . bin2hex(random_bytes(8)) . '.tmp';
                if (file_put_contents($tmp, $doc['bytes'], LOCK_EX) !== $doc['size'] || ! chmod($tmp, 0640) || ! rename($tmp, $path)) {
                    @unlink($tmp);
                    throw new RuntimeException('QUOTE_STORAGE_UNAVAILABLE');
                }
            }
            if (! $file) {
                $public = self::uuid();
                $id = $this->insert('files', ['organization_id' => $org, 'public_id' => $public, 'storage_backend' => self::STORAGE, 'storage_key' => $key, 'detected_mime' => 'application/pdf',
                    'size_bytes' => $doc['size'], 'sha256' => hex2bin($doc['sha256']), 'scan_status' => 'pending', 'retention_class' => 'supplier_quote', 'created_by' => $actor, 'created_at' => gmdate('Y-m-d H:i:s')]);
                $file = ['id' => $id, 'public_id' => $public];
            }
        }
        $this->exec("UPDATE entity_files SET file_role='documentFile.history' WHERE organization_id=? AND entity_id=? AND file_role='documentFile'", [$org, $entity]);
        $this->insert('entity_files', ['organization_id' => $org, 'entity_id' => $entity, 'file_id' => $file['id'], 'association_key' => 'sf-quote-document-v' . $version, 'file_role' => 'documentFile',
            'original_filename' => $doc['name'], 'declared_mime' => 'application/pdf', 'declared_size_bytes' => $doc['size'], 'created_at' => gmdate('Y-m-d H:i:s')]);
        return ['id' => $file['public_id'], 'name' => $doc['name'], 'size' => $doc['size'], 'sha256' => $doc['sha256']];
    }

    /** Current PDF of the quote (sha256 hex) or null. */
    private function currentDocument(int $org, int $entity): ?array
    {
        return $this->one("SELECT LOWER(HEX(f.sha256)) AS sha256,ef.original_filename AS name FROM entity_files ef JOIN files f ON f.id=ef.file_id AND f.organization_id=ef.organization_id
            WHERE ef.organization_id=? AND ef.entity_id=? AND ef.file_role='documentFile' ORDER BY ef.id DESC LIMIT 1", [$org, $entity]);
    }

    public function create(int $org, int $actor, array $p, string $today, string $key): array
    {
        $endpoint = 'quotes.supplier_quote.create';
        $hash = hash('sha256', self::json(SupplierQuoteInput::fingerprint($p)), true);
        $lock = 'supplyflow.quotes.supplier.' . $org;
        $this->lock($lock);
        $this->db->begin_transaction();
        try {
            if ($again = $this->claim($org, $actor, $endpoint, $key, $hash)) {
                $this->db->commit();
                return $again;
            }
            $rfq = $this->one("SELECT f.id,f.folio,f.requisition_id,f.supplier_id,f.status_code,f.legacy_status,r.folio AS requisition,re.public_id AS requisition_id_public,re.archived_at AS req_archived,
                    s.legal_name AS supplier_name,se.public_id AS supplier_public
                FROM rfqs f JOIN business_entities e ON e.id=f.id AND e.organization_id=f.organization_id
                JOIN requisitions r ON r.id=f.requisition_id AND r.organization_id=f.organization_id JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
                JOIN suppliers s ON s.id=f.supplier_id AND s.organization_id=f.organization_id JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id
                WHERE f.organization_id=? AND e.public_id=? AND e.archived_at IS NULL", [$org, $p['rfq_id']]);
            if (! $rfq) {
                throw new QuoteConflict('NOT_FOUND', 'RFQ no encontrada.', 404);
            }
            if ($rfq['req_archived'] !== null) {
                throw new QuoteConflict('REQUISITION_ARCHIVED', "La requisición {$rfq['requisition']} está archivada.");
            }
            $st = mb_strtolower(trim((string) ($rfq['legacy_status'] ?: $rfq['status_code'])));
            if (in_array(mb_strtolower((string) $rfq['status_code']), self::RFQ_NOT_SENT, true) || in_array($st, self::RFQ_NOT_SENT, true)) {
                throw new QuoteConflict('RFQ_NOT_SENT', "La RFQ {$rfq['folio']} no se ha enviado al proveedor (estatus «" . ($rfq['legacy_status'] ?: $rfq['status_code']) . '»): no puede recibir cotización.');
            }
            if ($prev = $this->one('SELECT folio FROM supplier_quotes WHERE organization_id=? AND rfq_id=? ORDER BY id LIMIT 1', [$org, $rfq['id']])) {
                throw new QuoteConflict('RFQ_ALREADY_QUOTED', "La RFQ {$rfq['folio']} ya tiene la cotización {$prev['folio']}: edítala desde la matriz interna de proveedores.");
            }
            $this->currency($p['currency']);
            $items = [];
            foreach ($this->rows('SELECT id,line_number,requisition_item_id,resolution_status,description,category_snapshot,unit_label,quantity FROM rfq_items WHERE organization_id=? AND rfq_id=?', [$org, $rfq['id']]) as $i) {
                $items[(int) $i['line_number']] = $i;
            }
            self::sameLines($p['lines'], $items);
            $amounts = SupplierQuoteInput::amounts($p['lines'], $p['vat']);
            $folio = $this->nextFolio($org, $today);
            $public = self::uuid();
            $now = gmdate('Y-m-d H:i:s');
            $id = $this->insert('business_entities', ['organization_id' => $org, 'public_id' => $public, 'entity_kind' => 'supplier_quote', 'created_at' => $now, 'updated_at' => $now,
                'created_by' => $actor, 'updated_by' => $actor, 'row_version' => 1]);
            $this->insert('supplier_quotes', ['id' => $id, 'organization_id' => $org, 'requisition_id' => $rfq['requisition_id'], 'supplier_id' => $rfq['supplier_id'], 'rfq_id' => $rfq['id'], 'folio' => $folio,
                'supplier_reference' => $p['supplier_reference'] === '' ? null : $p['supplier_reference'], 'quote_date' => $p['quote_date'], 'valid_until' => $p['valid_until'], 'currency_code' => $p['currency'],
                'subtotal_amount' => $amounts['subtotal'], 'tax_rate_pct' => $p['vat'], 'tax_amount' => $amounts['tax'], 'total_amount' => $amounts['total'], 'calculation_version' => self::CALCULATION,
                'reconciliation_status' => 'not_required', 'source_kind' => 'explicit', 'lead_days' => $p['lead_days'], 'payment_terms' => $p['payment'], 'technical_score' => $p['technical'],
                'document_score' => $p['documentation'], 'notes' => $p['notes'] === '' ? null : $p['notes'], 'status_code' => self::STATUS, 'legacy_status' => self::STATUS_LABEL]);
            foreach ($p['lines'] as $l) {
                $i = $items[$l['line_number']];
                $resolved = $i['requisition_item_id'] !== null;
                $this->insert('supplier_quote_items', ['organization_id' => $org, 'requisition_id' => $rfq['requisition_id'], 'supplier_quote_id' => $id, 'requisition_item_id' => $i['requisition_item_id'],
                    'rfq_item_id' => $i['id'], 'line_number' => $l['line_number'], 'resolution_status' => $resolved ? 'resolved' : 'legacy_unresolved', 'description' => $i['description'],
                    'category_snapshot' => $i['category_snapshot'], 'unit_label' => $i['unit_label'], 'requested_quantity' => $i['quantity'], 'offered' => $l['offered'] ? 1 : 0,
                    'quantity' => $l['qty'], 'unit_price' => $l['price'], 'line_subtotal' => $amounts['lines'][$l['line_number']]]);
            }
            $document = $p['document'] === null ? null : $this->document($org, $actor, $id, 1, $p['document']);
            $view = self::view($p, $amounts) + ['offered_lines' => count(array_filter($p['lines'], static fn ($l) => $l['offered'])), 'lines' => count($p['lines'])];
            $this->event($org, (int) $rfq['requisition_id'], $actor, 'supplier_quote', 'quote.recorded', self::STATUS, ['quote' => $public, 'folio' => $folio, 'rfq' => $rfq['folio'], 'supplier' => $rfq['supplier_name'], 'document' => $document['name'] ?? null] + $view,
                "Cotización {$folio} de {$rfq['supplier_name']} registrada contra {$rfq['folio']}.");
            $this->audit($org, $id, $actor, 'supplier_quote.create', ['folio' => $folio, 'rfq' => $rfq['folio'], 'requisition' => $rfq['requisition'], 'supplier' => $rfq['supplier_name'],
                'after' => $view, 'document' => $document ? ['name' => $document['name'], 'sha256' => $document['sha256'], 'size' => $document['size']] : null]);
            $out = ['id' => $public, 'folio' => $folio, 'rfq' => $rfq['folio'], 'requisition' => $rfq['requisition'], 'requisition_id' => $rfq['requisition_id_public'], 'supplier_name' => $rfq['supplier_name'],
                'currency' => $p['currency'], 'subtotal' => $amounts['subtotal'], 'tax' => $amounts['tax'], 'total' => $amounts['total'], 'version' => 1,
                'document' => $document ? ['name' => $document['name'], 'size' => $document['size']] : null, 'replayed' => false];
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

    public function update(int $org, int $actor, string $public, int $version, array $p, string $key): array
    {
        $endpoint = 'quotes.supplier_quote.update:' . $public;
        $hash = hash('sha256', self::json(SupplierQuoteInput::fingerprint($p) + ['_version' => $version]), true);
        $lock = 'supplyflow.quotes.supplier.' . $org;
        $this->lock($lock);
        $this->db->begin_transaction();
        try {
            if ($again = $this->claim($org, $actor, $endpoint, $key, $hash)) {
                $this->db->commit();
                return $again;
            }
            $q = $this->one("SELECT q.*,e.row_version,e.imported_at,e.legacy_id,r.folio AS requisition,f.folio AS rfq_folio,s.legal_name AS supplier_name
                FROM supplier_quotes q JOIN business_entities e ON e.id=q.id AND e.organization_id=q.organization_id AND e.entity_kind='supplier_quote'
                JOIN requisitions r ON r.id=q.requisition_id AND r.organization_id=q.organization_id JOIN suppliers s ON s.id=q.supplier_id AND s.organization_id=q.organization_id
                LEFT JOIN rfqs f ON f.id=q.rfq_id AND f.organization_id=q.organization_id
                WHERE q.organization_id=? AND e.public_id=? AND e.archived_at IS NULL", [$org, $public]);
            if (! $q) {
                throw new QuoteConflict('NOT_FOUND', 'Cotización no encontrada.', 404);
            }
            if ($q['imported_at'] !== null || $q['legacy_id'] !== null || $q['source_kind'] !== 'explicit' || $q['rfq_id'] === null) {
                throw new QuoteConflict('IMPORTED_READ_ONLY', "{$q['folio']} es una cotización importada del sistema original: se conserva como expediente y no se edita.");
            }
            if ($this->one("SELECT 1 AS x FROM awards WHERE organization_id=? AND supplier_quote_id=? AND status_code='active' AND superseded_at IS NULL LIMIT 1", [$org, $q['id']])) {
                throw new QuoteConflict('AWARDED_READ_ONLY', "{$q['folio']} tiene adjudicación vigente: se conserva para trazabilidad y no se edita.");
            }
            if ($q['status_code'] !== self::STATUS) {
                throw new QuoteConflict('STATUS_READ_ONLY', "{$q['folio']} ya no está en estatus «Recibida» y no se edita.");
            }
            if ((int) $q['row_version'] !== $version) {
                throw new QuoteStale('La cotización cambió desde que se abrió. Vuelve a abrirla desde la matriz.');
            }
            $this->currency($p['currency']);
            $have = [];
            foreach ($this->rows('SELECT id,line_number,offered,quantity,unit_price,line_subtotal FROM supplier_quote_items WHERE organization_id=? AND supplier_quote_id=?', [$org, $q['id']]) as $i) {
                $have[(int) $i['line_number']] = $i;
            }
            self::sameLines($p['lines'], $have);
            $amounts = SupplierQuoteInput::amounts($p['lines'], $p['vat']);
            $before = ['supplier_reference' => $q['supplier_reference'], 'quote_date' => $q['quote_date'], 'valid_until' => $q['valid_until'], 'currency' => $q['currency_code'], 'vat' => self::dec($q['tax_rate_pct']),
                'lead_days' => $q['lead_days'] === null ? null : (int) $q['lead_days'], 'payment' => $q['payment_terms'], 'technical' => self::dec($q['technical_score']), 'documentation' => self::dec($q['document_score']),
                'notes' => $q['notes'], 'subtotal' => (float) $q['subtotal_amount'], 'tax' => (float) $q['tax_amount'], 'total' => (float) $q['total_amount']];
            $after = self::view($p, $amounts);
            $changed = array_keys(array_filter($after, static fn ($v, $k) => self::dec($before[$k] ?? '') !== self::dec($v ?? ''), ARRAY_FILTER_USE_BOTH));
            $lineChanges = [];
            foreach ($p['lines'] as $l) {
                $h = $have[$l['line_number']];
                if ((bool) $h['offered'] !== $l['offered'] || self::dec($h['quantity']) !== self::dec($l['qty']) || self::dec($h['unit_price']) !== self::dec($l['price'])) {
                    $lineChanges[] = ['line' => $l['line_number'], 'before' => ['offered' => (bool) $h['offered'], 'qty' => self::dec($h['quantity']), 'price' => self::dec($h['unit_price'])],
                        'after' => ['offered' => $l['offered'], 'qty' => self::dec($l['qty']), 'price' => self::dec($l['price'])], 'row' => (int) $h['id'], 'subtotal' => $amounts['lines'][$l['line_number']]];
                }
            }
            $current = $this->currentDocument($org, (int) $q['id']);
            $newDocument = $p['document'] !== null && ($current === null || ! hash_equals((string) $current['sha256'], $p['document']['sha256']) || $current['name'] !== $p['document']['name']);
            if ($lineChanges) {
                $changed[] = 'lines';
            }
            if ($newDocument) {
                $changed[] = 'document';
            }
            $newVersion = $version;
            $document = null;
            if ($changed) {
                $this->exec('UPDATE supplier_quotes SET supplier_reference=?,quote_date=?,valid_until=?,currency_code=?,subtotal_amount=?,tax_rate_pct=?,tax_amount=?,total_amount=?,lead_days=?,payment_terms=?,technical_score=?,document_score=?,notes=? WHERE organization_id=? AND id=?',
                    [$p['supplier_reference'] === '' ? null : $p['supplier_reference'], $p['quote_date'], $p['valid_until'], $p['currency'], $amounts['subtotal'], $p['vat'], $amounts['tax'], $amounts['total'],
                        $p['lead_days'], $p['payment'], $p['technical'], $p['documentation'], $p['notes'] === '' ? null : $p['notes'], $org, $q['id']]);
                foreach ($lineChanges as $c) {
                    $l = $c['after'];
                    $this->exec('UPDATE supplier_quote_items SET offered=?,quantity=?,unit_price=?,line_subtotal=? WHERE organization_id=? AND id=? AND supplier_quote_id=?',
                        [$l['offered'] ? 1 : 0, $l['offered'] ? $l['qty'] : '0', $l['offered'] ? $l['price'] : '0', $c['subtotal'], $org, $c['row'], $q['id']]);
                }
                if ($this->exec('UPDATE business_entities SET row_version=row_version+1,updated_at=UTC_TIMESTAMP(6),updated_by=? WHERE organization_id=? AND id=? AND row_version=?', [$actor, $org, $q['id'], $version]) !== 1) {
                    throw new QuoteStale('La cotización cambió desde que se abrió. Vuelve a abrirla desde la matriz.');
                }
                $newVersion = $version + 1;
                if ($newDocument) {
                    $document = $this->document($org, $actor, (int) $q['id'], $newVersion, $p['document']);
                }
                $lines = array_map(static fn ($c) => ['line' => $c['line'], 'before' => $c['before'], 'after' => $c['after']], $lineChanges);
                $this->event($org, (int) $q['requisition_id'], $actor, 'supplier_quote', 'quote.updated', self::STATUS, ['quote' => $public, 'folio' => $q['folio'], 'rfq' => $q['rfq_folio'], 'changed' => $changed, 'lines' => $lines, 'document' => $document['name'] ?? null] + $after,
                    "Cotización {$q['folio']} de {$q['supplier_name']} actualizada (" . implode(', ', $changed) . ').');
                $this->audit($org, (int) $q['id'], $actor, 'supplier_quote.update', ['folio' => $q['folio'], 'rfq' => $q['rfq_folio'], 'requisition' => $q['requisition'], 'changed' => $changed,
                    'before' => $before, 'after' => $after, 'lines' => $lines, 'document' => $document ? ['name' => $document['name'], 'sha256' => $document['sha256'], 'size' => $document['size'], 'previous' => $current['name'] ?? null] : null]);
            }
            $out = ['id' => $public, 'folio' => $q['folio'], 'version' => $newVersion, 'changed' => $changed, 'currency' => $p['currency'], 'subtotal' => $amounts['subtotal'], 'tax' => $amounts['tax'],
                'total' => $amounts['total'], 'document' => $document ? ['name' => $document['name'], 'size' => $document['size']] : null, 'replayed' => false];
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
