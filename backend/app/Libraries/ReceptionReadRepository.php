<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * Recepción y Entrega · read-only queries (API account, schema SELECT). Registering receipts, deliveries, signatures or
 * photos is NOT exposed. Evidence files are listed by metadata only (no storage key, no download).
 *
 * Rules (documented in docs/frontend/MAPA_MODULOS_CONECTADOS.md):
 * - Receipt progress: legacy header receipts keep their recorded percent; line-item receipts = received / ordered quantity.
 *   A PO series' progress is the max of its legacy percents and the cumulative line-item percent against the current version.
 * - Receipt acceptance: the latest delivery linked to the receipt; without one, the legacy acceptance captured in the
 *   receipt (Apps Script "clientAccept").
 * - Ready to invoice mirrors stage 6 of the Apps Script matrix: every current, non-cancelled PO of the requisition is
 *   received at 100 % with accepted delivery, and the requisition has no non-cancelled invoice.
 */
final class ReceptionReadRepository
{
    private const CANCELLED = "LOWER(COALESCE(po.legacy_status,po.operational_status,'')) IN ('cancelada','sustituida','cancelled','superseded')";
    private const LATEST = 'NOT EXISTS (SELECT 1 FROM purchase_orders nx WHERE nx.organization_id=po.organization_id AND nx.series_public_id=po.series_public_id AND nx.version_number>po.version_number)';
    private const ACCEPTED = '/^(accepted|aceptad)/i';

    private BaseConnection $db;

    public function __construct(?BaseConnection $connection = null)
    {
        $this->db = $connection ?? Database::connect();
        $this->db->initialize();
    }

    private function rows(string $sql, array $binds = []): array
    {
        $result = $this->db->query($sql, $binds);
        if ($result === false) {
            throw new RuntimeException('RECEPTION_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    private static function like(string $v): string
    {
        return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $v) . '%';
    }

    /** Name from a JSON person snapshot (object with a name-like key, or a JSON string). */
    private static function snapName(string $col): string
    {
        return "(CASE WHEN {$col} IS NULL OR NOT JSON_VALID({$col}) THEN NULL WHEN JSON_TYPE({$col})='STRING' THEN JSON_UNQUOTE({$col}) ELSE COALESCE(JSON_VALUE({$col},'$.name'),JSON_VALUE({$col},'$.nombre'),JSON_VALUE({$col},'$.displayName'),JSON_VALUE({$col},'$.fullName'),JSON_VALUE({$col},'$.full_name')) END)";
    }

    private static function legacyAccept(string $alias = 'gr'): string
    {
        return "(CASE WHEN {$alias}.legacy_delivery_snapshot IS NOT NULL AND JSON_VALID({$alias}.legacy_delivery_snapshot) THEN NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT({$alias}.legacy_delivery_snapshot,'$.clientAccept'))),'') END)";
    }

    public static function isAccepted(?string $v): bool
    {
        return $v !== null && preg_match(self::ACCEPTED, trim($v)) === 1;
    }

    private static function num(array &$rows, array $ints, array $floats = []): void
    {
        foreach ($rows as &$r) {
            foreach ($ints as $k) {
                $r[$k] = $r[$k] === null ? null : (int) $r[$k];
            }
            foreach ($floats as $k) {
                $r[$k] = $r[$k] === null ? null : round((float) $r[$k], 2);
            }
        }
        unset($r);
    }

    /** Receipts with effective progress and acceptance. */
    private function receiptRows(int $org, string $where = '', array $binds = []): array
    {
        $accept = self::legacyAccept();
        $rows = $this->rows(<<<SQL
            SELECT e.public_id AS id,gr.id AS db_id,gr.folio,gr.receipt_date AS date,gr.capture_grain,gr.status_code AS status,gr.legacy_type,
                   gr.legacy_received_percent,gr.quality_result,gr.documentation_result,gr.notes,{$accept} AS legacy_acceptance,
                   po.id AS po_db_id,pe.public_id AS po_id,po.folio AS po_folio,po.version_number AS po_version,po.series_public_id AS series_id,
                   s.legal_name AS supplier_name,
                   (SELECT GROUP_CONCAT(DISTINCT r.folio ORDER BY r.folio SEPARATOR ', ') FROM purchase_order_requisitions pr JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id WHERE pr.organization_id=gr.organization_id AND pr.purchase_order_id=gr.purchase_order_id) AS requisitions,
                   (SELECT GROUP_CONCAT(DISTINCT c.legal_name ORDER BY c.legal_name SEPARATOR ', ') FROM purchase_order_requisitions pr JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id WHERE pr.organization_id=gr.organization_id AND pr.purchase_order_id=gr.purchase_order_id) AS client_name,
                   (SELECT COUNT(*) FROM goods_receipt_items gi WHERE gi.organization_id=gr.organization_id AND gi.goods_receipt_id=gr.id) AS item_count,
                   (SELECT SUM(gi.received_quantity) FROM goods_receipt_items gi WHERE gi.organization_id=gr.organization_id AND gi.goods_receipt_id=gr.id) AS received_qty,
                   (SELECT SUM(gi.rejected_quantity) FROM goods_receipt_items gi WHERE gi.organization_id=gr.organization_id AND gi.goods_receipt_id=gr.id) AS rejected_qty,
                   (SELECT SUM(pi.quantity) FROM purchase_order_items pi WHERE pi.organization_id=gr.organization_id AND pi.purchase_order_id=gr.purchase_order_id) AS ordered_qty,
                   (SELECT COUNT(*) FROM entity_files ef WHERE ef.organization_id=gr.organization_id AND ef.entity_id=gr.id) AS file_count,
                   (SELECT COUNT(*) FROM signature_evidence sg WHERE sg.organization_id=gr.organization_id AND sg.entity_id=gr.id) AS signature_count,
                   (SELECT COUNT(DISTINCT ds.delivery_id) FROM delivery_sources ds WHERE ds.organization_id=gr.organization_id AND ds.goods_receipt_id=gr.id) AS delivery_count,
                   (SELECT d.acceptance_status FROM delivery_sources ds JOIN deliveries d ON d.id=ds.delivery_id AND d.organization_id=ds.organization_id WHERE ds.organization_id=gr.organization_id AND ds.goods_receipt_id=gr.id ORDER BY d.delivery_date DESC,d.id DESC LIMIT 1) AS delivery_acceptance
            FROM goods_receipts gr
            JOIN business_entities e ON e.id=gr.id AND e.organization_id=gr.organization_id
            JOIN purchase_orders po ON po.id=gr.purchase_order_id AND po.organization_id=gr.organization_id
            JOIN business_entities pe ON pe.id=po.id AND pe.organization_id=po.organization_id
            JOIN suppliers s ON s.id=po.supplier_id AND s.organization_id=po.organization_id
            WHERE gr.organization_id=? AND e.archived_at IS NULL {$where}
            ORDER BY gr.receipt_date DESC,gr.id DESC
            SQL, array_merge([$org], $binds));
        foreach ($rows as &$r) {
            $r['received_percent'] = $r['legacy_received_percent'] !== null ? round((float) $r['legacy_received_percent'], 2)
                : ($r['capture_grain'] === 'line_items' && (float) $r['ordered_qty'] > 0 ? round(100 * (float) $r['received_qty'] / (float) $r['ordered_qty'], 2) : null);
            $r['acceptance'] = $r['delivery_acceptance'] ?? $r['legacy_acceptance'];
            $r['acceptance_source'] = $r['delivery_acceptance'] !== null ? 'delivery' : ($r['legacy_acceptance'] !== null ? 'legacy_receipt' : null);
            $r['pending_reasons'] = array_values(array_filter([
                $r['received_percent'] === null ? 'progress_unknown' : ($r['received_percent'] < 100 ? 'partial' : null),
                (float) $r['rejected_qty'] > 0 ? 'rejected' : null,
                $r['quality_result'] !== null && preg_match('/^(conforme|conformant|according)$/i', trim($r['quality_result'])) !== 1 ? 'quality' : null,
                $r['documentation_result'] !== null && preg_match('/^(completa|complete)$/i', trim($r['documentation_result'])) !== 1 ? 'documentation' : null,
            ]));
        }
        unset($r);
        self::num($rows, ['po_version', 'item_count', 'file_count', 'signature_count', 'delivery_count'], ['received_qty', 'rejected_qty', 'ordered_qty']);
        return $rows;
    }

    private function deliveryRows(int $org, string $where = '', array $binds = []): array
    {
        $by = self::snapName('d.delivered_by_snapshot');
        $to = self::snapName('d.received_by_snapshot');
        $rows = $this->rows(<<<SQL
            SELECT e.public_id AS id,d.id AS db_id,d.folio,d.delivery_date AS date,d.control_reference,d.delivery_type,d.acceptance_status,d.status_code AS status,
                   d.legacy_status,d.delivery_place,{$by} AS delivered_by,{$to} AS received_by,d.evidence_text,d.notes,
                   (d.locked_at IS NOT NULL OR COALESCE(d.legacy_locked,0)=1) AS locked,c.legal_name AS client_name,ce.public_id AS client_id,
                   (SELECT GROUP_CONCAT(DISTINCT po.folio ORDER BY po.folio SEPARATOR ', ') FROM delivery_sources ds JOIN purchase_orders po ON po.id=ds.purchase_order_id AND po.organization_id=ds.organization_id WHERE ds.organization_id=d.organization_id AND ds.delivery_id=d.id) AS po_folios,
                   (SELECT GROUP_CONCAT(DISTINCT gr.folio ORDER BY gr.folio SEPARATOR ', ') FROM delivery_sources ds JOIN goods_receipts gr ON gr.id=ds.goods_receipt_id AND gr.organization_id=ds.organization_id WHERE ds.organization_id=d.organization_id AND ds.delivery_id=d.id) AS receipt_folios,
                   (SELECT GROUP_CONCAT(DISTINCT r.folio ORDER BY r.folio SEPARATOR ', ') FROM delivery_items di JOIN requisitions r ON r.id=di.requisition_id AND r.organization_id=di.organization_id WHERE di.organization_id=d.organization_id AND di.delivery_id=d.id) AS requisitions,
                   (SELECT COUNT(*) FROM delivery_items di WHERE di.organization_id=d.organization_id AND di.delivery_id=d.id) AS item_count,
                   (SELECT SUM(di.delivery_quantity) FROM delivery_items di WHERE di.organization_id=d.organization_id AND di.delivery_id=d.id) AS delivered_qty,
                   (SELECT COUNT(*) FROM entity_files ef WHERE ef.organization_id=d.organization_id AND ef.entity_id=d.id) AS file_count,
                   (SELECT COUNT(*) FROM signature_evidence sg WHERE sg.organization_id=d.organization_id AND sg.entity_id=d.id) AS signature_count,
                   (SELECT LOWER(HEX(sg.document_sha256)) FROM signature_evidence sg WHERE sg.organization_id=d.organization_id AND sg.entity_id=d.id AND sg.document_sha256 IS NOT NULL ORDER BY sg.signed_at DESC,sg.id DESC LIMIT 1) AS document_sha256
            FROM deliveries d
            JOIN business_entities e ON e.id=d.id AND e.organization_id=d.organization_id
            JOIN clients c ON c.id=d.client_id AND c.organization_id=d.organization_id
            JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id
            WHERE d.organization_id=? AND e.archived_at IS NULL {$where}
            ORDER BY d.delivery_date DESC,d.id DESC
            SQL, array_merge([$org], $binds));
        foreach ($rows as &$r) {
            $r['locked'] = (bool) $r['locked'];
        }
        unset($r);
        self::num($rows, ['item_count', 'file_count', 'signature_count'], ['delivered_qty']);
        return $rows;
    }

    /** Matrix: receipts and deliveries in one list (newest first), filtered by kind, client and text. */
    public function matrix(int $org, array $f): array
    {
        $rw = ''; $rb = []; $dw = ''; $db = [];
        if ($f['client'] !== 'all') {
            $rw .= ' AND EXISTS (SELECT 1 FROM purchase_order_requisitions pr JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id JOIN business_entities ce ON ce.id=r.client_id AND ce.organization_id=r.organization_id WHERE pr.organization_id=gr.organization_id AND pr.purchase_order_id=gr.purchase_order_id AND ce.public_id=?)';
            $rb[] = $f['client'];
            $dw .= ' AND ce.public_id=?';
            $db[] = $f['client'];
        }
        if ($f['q'] !== '') {
            $l = self::like($f['q']);
            $rw .= " AND (gr.folio LIKE ? ESCAPE '!' OR po.folio LIKE ? ESCAPE '!' OR s.legal_name LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM purchase_order_requisitions pr JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id WHERE pr.organization_id=gr.organization_id AND pr.purchase_order_id=gr.purchase_order_id AND (r.folio LIKE ? ESCAPE '!' OR c.legal_name LIKE ? ESCAPE '!')))";
            array_push($rb, $l, $l, $l, $l, $l);
            $dw .= " AND (d.folio LIKE ? ESCAPE '!' OR d.control_reference LIKE ? ESCAPE '!' OR c.legal_name LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM delivery_sources ds JOIN purchase_orders po ON po.id=ds.purchase_order_id AND po.organization_id=ds.organization_id LEFT JOIN goods_receipts gr ON gr.id=ds.goods_receipt_id AND gr.organization_id=ds.organization_id WHERE ds.organization_id=d.organization_id AND ds.delivery_id=d.id AND (po.folio LIKE ? ESCAPE '!' OR gr.folio LIKE ? ESCAPE '!')) OR EXISTS (SELECT 1 FROM delivery_items di JOIN requisitions r ON r.id=di.requisition_id AND r.organization_id=di.organization_id WHERE di.organization_id=d.organization_id AND di.delivery_id=d.id AND r.folio LIKE ? ESCAPE '!'))";
            array_push($db, $l, $l, $l, $l, $l, $l);
        }
        $receipts = $f['kind'] === 'delivery' ? [] : array_map(static fn ($r) => ['kind' => 'receipt'] + $r, $this->receiptRows($org, $rw, $rb));
        $deliveries = $f['kind'] === 'receipt' ? [] : array_map(static fn ($r) => ['kind' => 'delivery'] + $r, $this->deliveryRows($org, $dw, $db));
        $all = array_merge($receipts, $deliveries);
        usort($all, static fn ($a, $b) => [(string) $b['date'], $b['db_id']] <=> [(string) $a['date'], $a['db_id']]);
        foreach ($all as &$r) {
            unset($r['db_id'], $r['po_db_id']);
        }
        unset($r);
        $size = $f['page_size'];
        return [
            'items' => array_slice($all, ($f['page'] - 1) * $size, $size),
            'total' => count($all), 'page' => $f['page'], 'page_size' => $size,
            'summary' => ['receipts' => count($receipts), 'deliveries' => count($deliveries), 'clients' => $this->clientCards($org)],
        ];
    }

    private function clientCards(int $org): array
    {
        $rows = $this->rows(<<<'SQL'
            SELECT ce.public_id AS id,c.legal_name AS name,
              (SELECT COUNT(DISTINCT gr.id) FROM goods_receipts gr JOIN purchase_order_requisitions pr ON pr.purchase_order_id=gr.purchase_order_id AND pr.organization_id=gr.organization_id JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id WHERE gr.organization_id=c.organization_id AND r.client_id=c.id) AS receipts,
              (SELECT COUNT(*) FROM deliveries d WHERE d.organization_id=c.organization_id AND d.client_id=c.id) AS deliveries
            FROM clients c JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id
            WHERE c.organization_id=? AND ce.archived_at IS NULL
            HAVING receipts>0 OR deliveries>0 ORDER BY c.legal_name
            SQL, [$org]);
        self::num($rows, ['receipts', 'deliveries']);
        return $rows;
    }

    /** Current, non-cancelled POs with their reception progress across the series (card 1). */
    public function orders(int $org, array $f): array
    {
        $rows = $this->orderRows($org, $f['q']);
        $counts = ['pending' => 0, 'partial' => 0, 'complete' => 0];
        foreach ($rows as $r) {
            $counts[$r['reception']]++;
        }
        if ($f['status'] !== 'all') {
            $rows = array_values(array_filter($rows, static fn ($r) => $r['reception'] === $f['status']));
        }
        $size = $f['page_size'];
        $page = array_map(static function ($r) { unset($r['db_id']); return $r; }, array_slice($rows, ($f['page'] - 1) * $size, $size));
        return ['items' => $page, 'total' => count($rows), 'page' => $f['page'], 'page_size' => $size, 'summary' => $counts];
    }

    private function orderRows(int $org, string $q = ''): array
    {
        $where = '';
        $binds = [$org];
        if ($q !== '') {
            $l = self::like($q);
            $where = " AND (po.folio LIKE ? ESCAPE '!' OR s.legal_name LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM purchase_order_requisitions pr JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id WHERE pr.organization_id=po.organization_id AND pr.purchase_order_id=po.id AND (r.folio LIKE ? ESCAPE '!' OR c.legal_name LIKE ? ESCAPE '!')))";
            array_push($binds, $l, $l, $l, $l);
        }
        $series = '(SELECT s2.id FROM purchase_orders s2 WHERE s2.organization_id=po.organization_id AND s2.series_public_id=po.series_public_id)';
        $rows = $this->rows(<<<SQL
            SELECT e.public_id AS id,po.id AS db_id,po.folio,po.version_number,po.commitment_date,po.series_public_id AS series_id,s.legal_name AS supplier_name,
                   (SELECT GROUP_CONCAT(DISTINCT r.folio ORDER BY r.folio SEPARATOR ', ') FROM purchase_order_requisitions pr JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id WHERE pr.organization_id=po.organization_id AND pr.purchase_order_id=po.id) AS requisitions,
                   (SELECT GROUP_CONCAT(DISTINCT c.legal_name ORDER BY c.legal_name SEPARATOR ', ') FROM purchase_order_requisitions pr JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id WHERE pr.organization_id=po.organization_id AND pr.purchase_order_id=po.id) AS client_name,
                   (SELECT COUNT(*) FROM goods_receipts gr WHERE gr.organization_id=po.organization_id AND gr.purchase_order_id IN {$series}) AS receipt_count,
                   (SELECT MAX(gr.legacy_received_percent) FROM goods_receipts gr WHERE gr.organization_id=po.organization_id AND gr.purchase_order_id IN {$series}) AS legacy_percent,
                   (SELECT SUM(gi.received_quantity) FROM goods_receipt_items gi JOIN goods_receipts gr ON gr.id=gi.goods_receipt_id AND gr.organization_id=gi.organization_id WHERE gi.organization_id=po.organization_id AND gr.purchase_order_id IN {$series}) AS line_received,
                   (SELECT SUM(pi.quantity) FROM purchase_order_items pi WHERE pi.organization_id=po.organization_id AND pi.purchase_order_id=po.id) AS ordered_qty
            FROM purchase_orders po
            JOIN business_entities e ON e.id=po.id AND e.organization_id=po.organization_id
            JOIN suppliers s ON s.id=po.supplier_id AND s.organization_id=po.organization_id
            WHERE po.organization_id=? AND e.archived_at IS NULL AND {$this->latest()} AND NOT {$this->cancelled()} {$where}
            ORDER BY po.order_date DESC,po.id DESC
            SQL, $binds);
        foreach ($rows as &$r) {
            $line = $r['line_received'] !== null && (float) $r['ordered_qty'] > 0 ? 100 * (float) $r['line_received'] / (float) $r['ordered_qty'] : null;
            $vals = array_filter([$r['legacy_percent'] === null ? null : (float) $r['legacy_percent'], $line], static fn ($v) => $v !== null);
            $r['received_percent'] = $vals ? round(max($vals), 2) : ((int) $r['receipt_count'] > 0 ? null : 0.0);
            $r['reception'] = (int) $r['receipt_count'] === 0 ? 'pending' : ($r['received_percent'] !== null && $r['received_percent'] >= 100 ? 'complete' : 'partial');
            unset($r['legacy_percent'], $r['line_received']);
        }
        unset($r);
        self::num($rows, ['version_number', 'receipt_count'], ['ordered_qty']);
        return $rows;
    }

    private function latest(): string { return self::LATEST; }
    private function cancelled(): string { return self::CANCELLED; }

    /** PO header, ordered vs received per line (whole series) and its receipts (card 1 detail). */
    public function order(int $org, string $id): ?array
    {
        $po = $this->rows('SELECT po.id,po.series_public_id FROM purchase_orders po JOIN business_entities e ON e.id=po.id AND e.organization_id=po.organization_id WHERE po.organization_id=? AND e.public_id=? AND e.archived_at IS NULL', [$org, $id])[0] ?? null;
        if (! $po) {
            return null;
        }
        $head = array_values(array_filter($this->orderRows($org), static fn ($r) => $r['series_id'] === $po['series_public_id']))[0] ?? null;
        if (! $head) {
            return null; // cancelled / superseded series are not offered for reception
        }
        $items = $this->rows(<<<'SQL'
            SELECT pi.line_number,pi.description,pi.unit_label,pi.quantity,
              (SELECT SUM(gi.received_quantity) FROM goods_receipt_items gi JOIN goods_receipts gr ON gr.id=gi.goods_receipt_id AND gr.organization_id=gi.organization_id JOIN purchase_orders s2 ON s2.id=gr.purchase_order_id AND s2.organization_id=gr.organization_id WHERE gi.organization_id=pi.organization_id AND s2.series_public_id=? AND gi.line_number=pi.line_number) AS received,
              (SELECT SUM(gi.rejected_quantity) FROM goods_receipt_items gi JOIN goods_receipts gr ON gr.id=gi.goods_receipt_id AND gr.organization_id=gi.organization_id JOIN purchase_orders s2 ON s2.id=gr.purchase_order_id AND s2.organization_id=gr.organization_id WHERE gi.organization_id=pi.organization_id AND s2.series_public_id=? AND gi.line_number=pi.line_number) AS rejected
            FROM purchase_order_items pi WHERE pi.organization_id=? AND pi.purchase_order_id=? ORDER BY pi.line_number
            SQL, [$po['series_public_id'], $po['series_public_id'], $org, $head['db_id']]);
        self::num($items, ['line_number'], ['quantity', 'received', 'rejected']);
        $receipts = $this->receiptRows($org, ' AND po.series_public_id=?', [$po['series_public_id']]);
        foreach ($receipts as &$r) {
            unset($r['db_id'], $r['po_db_id']);
        }
        unset($r, $head['db_id']);
        return ['item' => $head, 'items' => $items, 'receipts' => $receipts];
    }

    private function evidence(int $org, int $entity): array
    {
        $files = $this->rows('SELECT ef.file_role AS role,ef.original_filename AS name,COALESCE(ef.declared_mime,f.detected_mime) AS mime,COALESCE(ef.declared_size_bytes,f.size_bytes) AS size_bytes,f.scan_status,ef.created_at FROM entity_files ef JOIN files f ON f.id=ef.file_id AND f.organization_id=ef.organization_id WHERE ef.organization_id=? AND ef.entity_id=? ORDER BY ef.file_role,ef.id', [$org, $entity]);
        self::num($files, ['size_bytes']);
        $name = self::snapName('sg.signer_snapshot');
        $signatures = $this->rows(<<<SQL
            SELECT sg.signature_role AS role,sg.method_label AS method,sg.signed_at,sg.integrity_verification_status AS integrity,sg.hashing_scope,
              LOWER(HEX(sg.document_sha256)) AS document_sha256,
              COALESCE((SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=sg.signer_user_id AND u.organization_id=sg.organization_id),
                       (SELECT c.legal_name FROM clients c WHERE c.id=sg.signer_client_id AND c.organization_id=sg.organization_id),{$name}) AS signer
            FROM signature_evidence sg WHERE sg.organization_id=? AND sg.entity_id=? ORDER BY sg.signed_at,sg.id
            SQL, [$org, $entity]);
        return ['files' => $files, 'signatures' => $signatures];
    }

    public function receipt(int $org, string $id): ?array
    {
        $r = $this->receiptRows($org, ' AND e.public_id=?', [$id])[0] ?? null;
        if (! $r) {
            return null;
        }
        $items = $this->rows(<<<'SQL'
            SELECT gi.line_number,pi.description,gi.unit_label,pi.quantity AS ordered,gi.received_quantity AS received,gi.accepted_quantity AS accepted,gi.rejected_quantity AS rejected,gi.quality_note
            FROM goods_receipt_items gi LEFT JOIN purchase_order_items pi ON pi.id=gi.purchase_order_item_id AND pi.organization_id=gi.organization_id
            WHERE gi.organization_id=? AND gi.goods_receipt_id=? ORDER BY gi.line_number
            SQL, [$org, $r['db_id']]);
        self::num($items, ['line_number'], ['ordered', 'received', 'accepted', 'rejected']);
        $deliveries = $this->deliveryRows($org, ' AND EXISTS (SELECT 1 FROM delivery_sources ds WHERE ds.organization_id=d.organization_id AND ds.delivery_id=d.id AND ds.goods_receipt_id=?)', [$r['db_id']]);
        foreach ($deliveries as &$d) {
            unset($d['db_id']);
        }
        unset($d);
        $ev = $this->evidence($org, (int) $r['db_id']);
        unset($r['db_id'], $r['po_db_id']);
        return ['item' => $r, 'items' => $items, 'deliveries' => $deliveries] + $ev;
    }

    public function delivery(int $org, string $id): ?array
    {
        $d = $this->deliveryRows($org, ' AND e.public_id=?', [$id])[0] ?? null;
        if (! $d) {
            return null;
        }
        $items = $this->rows(<<<'SQL'
            SELECT di.line_number,di.description,di.unit_label,di.delivery_quantity AS delivered,di.requested_qty_snapshot AS requested,di.received_qty_snapshot AS received,
                   di.previous_delivered_qty_snapshot AS previously_delivered,di.balance_after_snapshot AS balance,r.folio AS requisition
            FROM delivery_items di JOIN requisitions r ON r.id=di.requisition_id AND r.organization_id=di.organization_id
            WHERE di.organization_id=? AND di.delivery_id=? ORDER BY di.line_number,di.id
            SQL, [$org, $d['db_id']]);
        self::num($items, ['line_number'], ['delivered', 'requested', 'received', 'previously_delivered', 'balance']);
        $sources = $this->rows(<<<'SQL'
            SELECT ds.source_ordinal AS ordinal,po.folio AS po_folio,po.version_number AS po_version,gr.folio AS receipt_folio,ge.public_id AS receipt_id,r.folio AS requisition
            FROM delivery_sources ds JOIN purchase_orders po ON po.id=ds.purchase_order_id AND po.organization_id=ds.organization_id
            LEFT JOIN goods_receipts gr ON gr.id=ds.goods_receipt_id AND gr.organization_id=ds.organization_id
            LEFT JOIN business_entities ge ON ge.id=gr.id AND ge.organization_id=gr.organization_id
            LEFT JOIN requisitions r ON r.id=ds.requisition_id AND r.organization_id=ds.organization_id
            WHERE ds.organization_id=? AND ds.delivery_id=? ORDER BY ds.source_ordinal
            SQL, [$org, $d['db_id']]);
        self::num($sources, ['ordinal', 'po_version']);
        $ev = $this->evidence($org, (int) $d['db_id']);
        unset($d['db_id']);
        return ['item' => $d, 'items' => $items, 'sources' => $sources] + $ev;
    }

    /** Closing traffic light (card 4): five conditions with their documents. */
    public function closure(int $org): array
    {
        $orders = $this->orderRows($org);
        $receipts = $this->receiptRows($org);
        $deliveries = $this->deliveryRows($org);
        $poRef = static fn ($o) => ['id' => $o['id'], 'folio' => $o['folio'], 'version_number' => $o['version_number'], 'supplier_name' => $o['supplier_name'], 'requisitions' => $o['requisitions'], 'client_name' => $o['client_name'], 'commitment_date' => $o['commitment_date'], 'received_percent' => $o['received_percent']];
        $recRef = static fn ($r) => ['id' => $r['id'], 'folio' => $r['folio'], 'date' => $r['date'], 'po_folio' => $r['po_folio'], 'client_name' => $r['client_name'], 'received_percent' => $r['received_percent'], 'acceptance' => $r['acceptance'], 'pending_reasons' => $r['pending_reasons']];
        $withoutReceipt = array_values(array_map($poRef, array_filter($orders, static fn ($o) => $o['receipt_count'] === 0)));
        $pendingReceipts = array_values(array_map($recRef, array_filter($receipts, static fn ($r) => $r['pending_reasons'] !== [])));
        $notDelivered = array_values(array_map($recRef, array_filter($receipts, static fn ($r) => $r['acceptance'] === null)));
        $pendingAcceptance = array_values(array_merge(
            array_map(static fn ($d) => ['kind' => 'delivery', 'id' => $d['id'], 'folio' => $d['folio'], 'date' => $d['date'], 'client_name' => $d['client_name'], 'acceptance' => $d['acceptance_status'], 'references' => $d['po_folios']],
                array_filter($deliveries, static fn ($d) => ! self::isAccepted($d['acceptance_status']))),
            array_map(static fn ($r) => ['kind' => 'receipt', 'id' => $r['id'], 'folio' => $r['folio'], 'date' => $r['date'], 'client_name' => $r['client_name'], 'acceptance' => $r['acceptance'], 'references' => $r['po_folio']],
                array_filter($receipts, static fn ($r) => $r['acceptance_source'] === 'legacy_receipt' && ! self::isAccepted($r['acceptance']))),
        ));
        // Ready to invoice (stage 6): per requisition with current non-cancelled POs, all received ≥100 % and accepted, no invoice.
        $acceptedSeries = [];
        foreach ($receipts as $r) {
            if (self::isAccepted($r['acceptance'])) {
                $acceptedSeries[$r['series_id']] = true;
            }
        }
        $links = $this->rows(<<<SQL
            SELECT r.id AS req_id,re.public_id AS id,r.folio,c.legal_name AS client_name,po.series_public_id AS series_id,po.folio AS po_folio
            FROM purchase_order_requisitions pr JOIN purchase_orders po ON po.id=pr.purchase_order_id AND po.organization_id=pr.organization_id
            JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id
            JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
            JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            WHERE pr.organization_id=? AND re.archived_at IS NULL AND {$this->latest()} AND NOT {$this->cancelled()}
              AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.organization_id=r.organization_id AND i.requisition_id=r.id AND LOWER(COALESCE(i.legacy_status,i.status_code,'')) NOT IN ('cancelada','cancelled'))
            ORDER BY r.folio,po.folio
            SQL, [$org]);
        $bySeries = [];
        foreach ($orders as $o) {
            $bySeries[$o['series_id']] = $o;
        }
        $reqs = [];
        foreach ($links as $l) {
            $o = $bySeries[$l['series_id']] ?? null;
            $ok = $o && $o['received_percent'] !== null && $o['received_percent'] >= 100 && isset($acceptedSeries[$l['series_id']]);
            $reqs[$l['req_id']] ??= ['id' => $l['id'], 'folio' => $l['folio'], 'client_name' => $l['client_name'], 'purchase_orders' => [], 'ready' => true];
            $reqs[$l['req_id']]['purchase_orders'][] = $l['po_folio'];
            $reqs[$l['req_id']]['ready'] = $reqs[$l['req_id']]['ready'] && $ok;
        }
        $ready = array_values(array_map(static fn ($r) => ['id' => $r['id'], 'folio' => $r['folio'], 'client_name' => $r['client_name'], 'purchase_orders' => implode(', ', array_unique($r['purchase_orders']))], array_filter($reqs, static fn ($r) => $r['ready'])));
        return [
            'counters' => ['po_without_receipt' => count($withoutReceipt), 'receipts_pending' => count($pendingReceipts), 'deliveries_missing' => count($notDelivered), 'acceptance_pending' => count($pendingAcceptance), 'ready_to_invoice' => count($ready)],
            'po_without_receipt' => $withoutReceipt, 'receipts_pending' => $pendingReceipts, 'deliveries_missing' => $notDelivered, 'acceptance_pending' => $pendingAcceptance, 'ready_to_invoice' => $ready,
        ];
    }
}
