<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * Portal del Cliente · lo que vería UN cliente, en solo lectura (cuenta API con SELECT). Todas las consultas se acotan al
 * cliente indicado, así que el mismo repositorio sirve para la vista previa interna (Master Admin, hoy) y para una sesión de
 * cliente (cuando se autorice el acceso externo, el cliente vendrá de la sesión y no de la URL).
 * Reglas de lo que el cliente ve: etapas = política de 8 etapas de la Matriz de requisiciones; cotizaciones = solo versiones
 * enviadas al cliente (enviada, vencida o con decisión), con precios de venta y sin costos ni márgenes; OC = solo folio,
 * fechas y estatus (sin proveedor ni montos); recepciones, entregas y facturas = folio, fecha, estatus y número de fotografías.
 */
final class ClientPortalReadRepository
{
    /** Estatus de cotización (QuoteReadRepository::STATUS_KEY) que el cliente ya recibió. */
    public const VISIBLE_QUOTE_KEYS = ['sent', 'expired', 'approved', 'rejected', 'change_requested'];
    private const QUOTE_LABEL = ['sent' => 'Enviada al cliente', 'expired' => 'Vencida', 'approved' => 'Aprobada', 'rejected' => 'Rechazada', 'change_requested' => 'Solicitud de modificación'];
    private const PO_CANCELLED = "LOWER(COALESCE(po.legacy_status,po.operational_status,'')) IN ('cancelada','sustituida','cancelled','superseded')";
    private const PO_LATEST = 'NOT EXISTS (SELECT 1 FROM purchase_orders nx WHERE nx.organization_id=po.organization_id AND nx.series_public_id=po.series_public_id AND nx.version_number>po.version_number)';
    private const PHOTOS = "(SELECT COUNT(*) FROM entity_files ef WHERE ef.organization_id=%1\$s.organization_id AND ef.entity_id=%1\$s.id AND (LOWER(ef.file_role) LIKE '%%photo%%' OR LOWER(ef.file_role) LIKE '%%foto%%'))";

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
            throw new RuntimeException('CLIENT_PORTAL_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    private static function visibleKeys(): string
    {
        return implode(',', array_map(static fn ($k) => "'{$k}'", self::VISIBLE_QUOTE_KEYS));
    }

    /** Clientes de la organización con el estado de su portal (para el selector de la vista previa interna). */
    public function clients(int $org): array
    {
        $rows = $this->rows(
            "SELECT ce.public_id AS id,c.code,c.legal_name AS name,c.brand_name,c.status_code AS status,c.portal_enabled,c.portal_locked,
                    (SELECT COUNT(*) FROM requisitions r JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
                      WHERE r.organization_id=c.organization_id AND r.client_id=c.id AND re.archived_at IS NULL) AS requisitions
             FROM clients c JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id
             WHERE c.organization_id=? AND ce.archived_at IS NULL ORDER BY c.legal_name,c.id",
            [$org]
        );
        return array_map(static fn ($r) => ['id' => $r['id'], 'code' => $r['code'], 'name' => $r['name'], 'brand_name' => $r['brand_name'], 'status' => $r['status'],
            'portal_enabled' => (bool) $r['portal_enabled'], 'portal_locked' => (bool) $r['portal_locked'], 'requisitions' => (int) $r['requisitions']], $rows);
    }

    /** id interno del cliente a partir de su id público (null si no existe en la organización). */
    public function clientId(int $org, string $public): ?int
    {
        $r = $this->rows('SELECT c.id FROM clients c JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id WHERE c.organization_id=? AND ce.public_id=? AND ce.archived_at IS NULL', [$org, $public]);
        return $r ? (int) $r[0]['id'] : null;
    }

    public function overview(int $org, int $client): array
    {
        $c = $this->rows(
            "SELECT ce.public_id AS id,c.code,c.legal_name AS name,c.brand_name,c.tax_identifier AS tax_id,c.default_project_reference AS project,
                    c.default_contract_reference AS contract,c.status_code AS status,c.portal_enabled,c.portal_locked,
                    EXISTS (SELECT 1 FROM entity_files ef WHERE ef.organization_id=c.organization_id AND ef.entity_id=c.id AND ef.file_role='clientLogo') AS has_logo
             FROM clients c JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id WHERE c.organization_id=? AND c.id=?",
            [$org, $client]
        )[0];
        foreach (['portal_enabled', 'portal_locked', 'has_logo'] as $k) {
            $c[$k] = (bool) $c[$k];
        }
        $reqs = $this->rows(
            'SELECT r.id AS db_id,re.public_id AS id,r.folio,r.project_reference_snapshot AS project,r.contract_reference_snapshot AS contract,r.client_reference,
                    r.request_date,r.need_date,r.description,r.history_based,r.latest_change_request_id,
                    (SELECT COUNT(*) FROM requisition_items i WHERE i.organization_id=r.organization_id AND i.requisition_id=r.id AND COALESCE(i.line_status,\'active\')<>\'cancelled\') AS line_count
             FROM requisitions r JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
             WHERE r.organization_id=? AND r.client_id=? AND re.archived_at IS NULL ORDER BY r.request_date DESC,r.id DESC',
            [$org, $client]
        );
        $ids = array_map(static fn ($r) => (int) $r['db_id'], $reqs);
        $maps = $this->associations($org, $client);
        $docs = $this->documents($org, $client);
        $metrics = ['total' => count($reqs), 'in_progress' => 0, 'closed' => 0, 'avg_progress' => null, 'pending_delivery' => 0, 'pending_invoice' => 0, 'without_stage' => 0];
        $progress = [];
        $out = [];
        foreach ($reqs as $r) {
            $id = (int) $r['db_id'];
            $g = RequisitionRecoveryRepository::stage($r, $maps);
            if ($g === null) {
                $metrics['without_stage']++;
            } else {
                $progress[] = RequisitionRecoveryRepository::PROGRESS[$g];
                $g === 7 ? $metrics['closed']++ : $metrics['in_progress']++;
                if ($g === 5) { $metrics['pending_delivery']++; }
                if ($g === 6) { $metrics['pending_invoice']++; }
            }
            $out[] = ['id' => $r['id'], 'folio' => $r['folio'], 'project' => $r['project'], 'contract' => $r['contract'], 'client_reference' => $r['client_reference'],
                'request_date' => $r['request_date'], 'need_date' => $r['need_date'], 'description' => $r['description'], 'line_count' => (int) $r['line_count'],
                'stage' => $g === null ? null : $g + 1, 'progress' => $g === null ? null : RequisitionRecoveryRepository::PROGRESS[$g],
                'quotes' => $docs['quotes'][$id] ?? [], 'purchase_orders' => $docs['pos'][$id] ?? [], 'receipts' => $docs['receipts'][$id] ?? [],
                'deliveries' => $docs['deliveries'][$id] ?? [], 'invoices' => $docs['invoices'][$id] ?? []];
        }
        $metrics['avg_progress'] = $progress ? (int) round(array_sum($progress) / count($progress)) : null;
        unset($ids);
        return ['client' => $c, 'requisitions' => $out, 'metrics' => $metrics, 'stage_names' => RequisitionRecoveryRepository::STAGES, 'stage_policy' => 'apps-script-eight-stage-matrix',
            'read_only' => true, 'preview' => true];
    }

    /** Mapas de evidencia (misma forma que RequisitionRecoveryRepository::associations) solo de las requisiciones del cliente. */
    private function associations(int $org, int $client): array
    {
        $maps = [];
        $sources = ['rfqs' => 'x.requisition_id,x.status_code,x.legacy_status', 'supplier_quotes' => 'x.requisition_id,x.status_code,x.legacy_status',
            'customer_quote_versions' => 'x.requisition_id', 'requisition_reviews' => 'x.requisition_id', 'awards' => 'x.requisition_id',
            'invoices' => 'x.requisition_id,x.status_code,x.legacy_status'];
        foreach ($sources as $t => $cols) {
            foreach ($this->rows("SELECT {$cols} FROM {$t} x JOIN requisitions r ON r.id=x.requisition_id AND r.organization_id=x.organization_id WHERE x.organization_id=? AND r.client_id=?", [$org, $client]) as $row) {
                $maps[$t][(int) $row['requisition_id']][] = $row;
            }
        }
        foreach ($this->rows(<<<'SQL'
            SELECT pr.requisition_id,p.id,p.legacy_status,p.operational_status,
              gr.id AS receipt_id,gr.legacy_received_percent,JSON_UNQUOTE(JSON_EXTRACT(gr.legacy_delivery_snapshot,'$.clientAccept')) AS client_accept
            FROM purchase_order_requisitions pr JOIN purchase_orders p ON p.id=pr.purchase_order_id AND p.organization_id=pr.organization_id
            JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id
            LEFT JOIN goods_receipts gr ON gr.id=(SELECT MIN(gr0.id) FROM goods_receipts gr0 WHERE gr0.purchase_order_id=p.id AND gr0.organization_id=p.organization_id)
            WHERE pr.organization_id=? AND r.client_id=? AND LOWER(COALESCE(p.legacy_status,p.operational_status,'')) NOT IN ('cancelada','sustituida','cancelled','superseded')
            ORDER BY p.id,gr.id
            SQL, [$org, $client]) as $row) {
            $maps['pos'][(int) $row['requisition_id']][] = $row;
        }
        return $maps;
    }

    /** Documentos que el cliente puede ver, agrupados por requisición. */
    private function documents(int $org, int $client): array
    {
        $out = ['quotes' => [], 'pos' => [], 'receipts' => [], 'deliveries' => [], 'invoices' => []];
        $key = QuoteReadRepository::STATUS_KEY;
        $visible = self::visibleKeys();
        // Por cotización: la versión más reciente que ya se envió al cliente (las revisiones en preparación no se muestran).
        foreach ($this->rows(
            "SELECT * FROM (SELECT v.requisition_id,e.public_id AS id,v.folio,COALESCE(v.legacy_revision_number,v.version_number-1) AS revision,v.quote_date,v.valid_until,
                    v.currency_code AS currency,v.total_amount,({$key}) AS k,v.customer_quote_id,v.version_number
               FROM customer_quote_versions v JOIN business_entities e ON e.id=v.id AND e.organization_id=v.organization_id
               JOIN requisitions r ON r.id=v.requisition_id AND r.organization_id=v.organization_id
               WHERE v.organization_id=? AND r.client_id=?) q
             WHERE q.k IN ({$visible})
               AND NOT EXISTS (SELECT 1 FROM customer_quote_versions v JOIN requisitions r2 ON r2.id=v.requisition_id AND r2.organization_id=v.organization_id
                               WHERE v.organization_id=? AND v.customer_quote_id=q.customer_quote_id AND v.version_number>q.version_number AND ({$key}) IN ({$visible}))
             ORDER BY q.quote_date DESC,q.version_number DESC",
            [$org, $client, $org]
        ) as $q) {
            $out['quotes'][(int) $q['requisition_id']][] = ['id' => $q['id'], 'folio' => $q['folio'], 'revision' => (int) $q['revision'], 'quote_date' => $q['quote_date'],
                'valid_until' => $q['valid_until'], 'currency' => $q['currency'], 'total' => $q['total_amount'] === null ? null : round((float) $q['total_amount'], 2),
                'status' => $q['k'], 'status_label' => self::QUOTE_LABEL[$q['k']] ?? $q['k']];
        }
        // OC vigentes no canceladas: solo folio, fechas y estatus (sin proveedor ni montos).
        foreach ($this->rows(
            'SELECT pr.requisition_id,po.folio,po.order_date,po.commitment_date,COALESCE(NULLIF(TRIM(po.legacy_status),\'\'),po.operational_status) AS status
             FROM purchase_order_requisitions pr JOIN purchase_orders po ON po.id=pr.purchase_order_id AND po.organization_id=pr.organization_id
             JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id
             WHERE pr.organization_id=? AND r.client_id=? AND ' . self::PO_LATEST . ' AND NOT ' . self::PO_CANCELLED . ' ORDER BY po.order_date,po.folio',
            [$org, $client]
        ) as $p) {
            $out['pos'][(int) $p['requisition_id']][] = ['folio' => $p['folio'], 'order_date' => $p['order_date'], 'commitment_date' => $p['commitment_date'], 'status' => self::poStatus($p['status'])];
        }
        $photos = sprintf(self::PHOTOS, 'gr');
        foreach ($this->rows(
            "SELECT DISTINCT pr.requisition_id,gr.folio,gr.receipt_date,gr.legacy_received_percent,{$photos} AS photos
             FROM goods_receipts gr JOIN business_entities ge ON ge.id=gr.id AND ge.organization_id=gr.organization_id
             JOIN purchase_order_requisitions pr ON pr.purchase_order_id=gr.purchase_order_id AND pr.organization_id=gr.organization_id
             JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id
             WHERE gr.organization_id=? AND r.client_id=? AND ge.archived_at IS NULL ORDER BY gr.receipt_date,gr.folio",
            [$org, $client]
        ) as $g) {
            $out['receipts'][(int) $g['requisition_id']][] = ['folio' => $g['folio'], 'date' => $g['receipt_date'],
                'received_percent' => $g['legacy_received_percent'] === null ? null : round((float) $g['legacy_received_percent'], 2), 'photos' => (int) $g['photos']];
        }
        $photos = sprintf(self::PHOTOS, 'd');
        foreach ($this->rows(
            "SELECT DISTINCT di.requisition_id,d.folio,d.delivery_date,d.acceptance_status,COALESCE(NULLIF(TRIM(d.legacy_status),''),d.status_code) AS status,{$photos} AS photos
             FROM deliveries d JOIN business_entities de ON de.id=d.id AND de.organization_id=d.organization_id
             JOIN delivery_items di ON di.delivery_id=d.id AND di.organization_id=d.organization_id
             JOIN requisitions r ON r.id=di.requisition_id AND r.organization_id=di.organization_id
             WHERE d.organization_id=? AND r.client_id=? AND de.archived_at IS NULL ORDER BY d.delivery_date,d.folio",
            [$org, $client]
        ) as $d) {
            $out['deliveries'][(int) $d['requisition_id']][] = ['folio' => $d['folio'], 'date' => $d['delivery_date'], 'acceptance' => $d['acceptance_status'], 'status' => $d['status'], 'photos' => (int) $d['photos']];
        }
        foreach ($this->rows(
            "SELECT i.requisition_id,i.folio,i.invoice_number,i.issue_date,i.due_date,COALESCE(NULLIF(TRIM(i.legacy_status),''),i.status_code) AS status
             FROM invoices i JOIN requisitions r ON r.id=i.requisition_id AND r.organization_id=i.organization_id
             WHERE i.organization_id=? AND r.client_id=? AND LOWER(COALESCE(i.legacy_status,i.status_code,'')) NOT IN ('cancelada','cancelled','cancelado') ORDER BY i.issue_date,i.folio",
            [$org, $client]
        ) as $i) {
            $out['invoices'][(int) $i['requisition_id']][] = ['folio' => $i['folio'], 'invoice_number' => $i['invoice_number'], 'issue_date' => $i['issue_date'], 'due_date' => $i['due_date'], 'status' => $i['status']];
        }
        return $out;
    }

    private static function poStatus(?string $s): string
    {
        $map = ['issued' => 'Emitida', 'authorized' => 'Autorizada', 'approved' => 'Autorizada', 'draft' => 'En preparación', 'pending_approval' => 'En autorización', 'in_review' => 'En revisión', 'closed' => 'Cerrada'];
        $s = trim((string) $s);
        return $map[strtolower($s)] ?? ($s !== '' ? $s : 'Sin estatus');
    }

    /** Partidas de una requisición del cliente (lo que el cliente solicitó). */
    public function requisition(int $org, int $client, string $public): ?array
    {
        $h = $this->rows(
            'SELECT r.id,re.public_id AS public_id,r.folio,r.request_date,r.need_date,r.project_reference_snapshot AS project,r.contract_reference_snapshot AS contract,
                    r.client_reference,r.requester_name,r.delivery_place,r.description,r.notes
             FROM requisitions r JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
             WHERE r.organization_id=? AND r.client_id=? AND re.public_id=? AND re.archived_at IS NULL',
            [$org, $client, $public]
        )[0] ?? null;
        if (! $h) {
            return null;
        }
        $items = $this->rows("SELECT line_number,description,quantity,unit_label FROM requisition_items WHERE organization_id=? AND requisition_id=? AND COALESCE(line_status,'active')<>'cancelled' ORDER BY display_order,line_number,id", [$org, (int) $h['id']]);
        foreach ($items as &$i) {
            $i['line_number'] = (int) $i['line_number'];
            $i['quantity'] = $i['quantity'] === null ? null : (float) $i['quantity'];
        }
        unset($i);
        $h['id'] = $h['public_id'];
        unset($h['public_id']);
        return ['requisition' => $h, 'items' => $items, 'read_only' => true];
    }

    /** Cotización enviada al cliente (formato comercial): sin costos, márgenes, referencias internas ni historial interno. */
    public function quote(int $org, int $client, string $public): ?array
    {
        $key = QuoteReadRepository::STATUS_KEY;
        $ok = $this->rows(
            "SELECT ({$key}) AS k FROM customer_quote_versions v JOIN business_entities e ON e.id=v.id AND e.organization_id=v.organization_id
             JOIN requisitions r ON r.id=v.requisition_id AND r.organization_id=v.organization_id WHERE v.organization_id=? AND r.client_id=? AND e.public_id=?",
            [$org, $client, $public]
        )[0] ?? null;
        if (! $ok || ! in_array($ok['k'], self::VISIBLE_QUOTE_KEYS, true)) {
            return null;
        }
        $q = (new QuoteReadRepository($this->db))->customerQuote($org, $public);
        if (! $q) {
            return null;
        }
        $v = $q['item'];
        $allowed = ['id', 'folio', 'revision', 'quote_date', 'valid_until', 'currency', 'subtotal_amount', 'discount_amount', 'tax_rate_pct', 'tax_amount', 'total_amount',
            'service_fee_enabled', 'service_fee_rate_pct', 'service_fee_subtotal_amount', 'service_fee_tax_rate_pct', 'service_fee_tax_amount', 'service_fee_total_amount',
            'third_party_taxable_amount', 'third_party_tax_amount', 'third_party_total_amount', 'delivery_place', 'lead_time_text', 'payment_terms', 'warranty_text',
            'inclusions_text', 'exclusions_text', 'notes', 'requisition', 'client_name', 'client_tax_id', 'client_reference', 'project', 'contract', 'client_contact',
            'client_email', 'client_phone', 'prepared_by', 'prepared_by_position', 'reviewed_by', 'reviewed_by_position', 'approved_by', 'approved_by_position'];
        $head = array_intersect_key($v, array_flip($allowed));
        $head['status'] = $ok['k'];
        $head['status_label'] = self::QUOTE_LABEL[$ok['k']] ?? $ok['k'];
        $items = array_map(static fn ($i) => ['line_number' => (int) $i['line_number'], 'description' => $i['description'], 'brand_model' => $i['brand_model'], 'unit_label' => $i['unit_label'],
            'quantity' => $i['quantity'] === null ? null : (float) $i['quantity'], 'unit_price' => $i['unit_price'] === null ? null : (float) $i['unit_price'],
            'line_subtotal' => $i['line_subtotal'] === null ? null : (float) $i['line_subtotal']], $q['items']);
        $decisions = array_map(static fn ($d) => ['decision' => $d['decision_code'], 'date' => $d['decision_at']], $q['decisions']);
        $issuer = $q['issuer'] ? array_intersect_key($q['issuer'], array_flip(['legal_name', 'tax_identifier', 'phone', 'email', 'postal_address'])) : null;
        return ['quote' => $head, 'items' => $items, 'decisions' => $decisions, 'issuer' => $issuer, 'read_only' => true];
    }
}
