<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * Flujo del Proceso (solo lectura, cuenta API con SELECT): cuántos procesos hay en cada etapa de las dos rutas y los
 * indicadores de cada pestaña, derivados de la evidencia documental registrada en MariaDB.
 *
 * Procure-to-Pay (requisiciones que no son de la ruta de servicios): 15 etapas que AFINAN la política de 8 etapas que el
 * servidor ya aplica en la Matriz de requisiciones (RequisitionRecoveryRepository::stage); cada etapa de 15 pertenece a un
 * solo grupo de 8, así que ambas vistas siempre coinciden. Los expedientes que esa política no infiere (desde historial o con
 * control de cambios) se informan aparte, sin etapa. Service-to-Cash: las 8 etapas del Dashboard (AnalyticsReadRepository).
 * Nada se guarda: no hay escrituras.
 */
final class ProcessFlowReadRepository
{
    public const P2P_STAGES = ['Solicitud / requisición', 'Validación interna', 'Estrategia y lotificación por partida', 'RFQ por lote y proveedor',
        'Recepción de ofertas', 'Comparativo y adjudicación por partida', 'Cotización al cliente', 'Revisión comercial', 'Autorización comercial',
        'Envío al cliente', 'Decisión del cliente', 'Órdenes de compra por proveedor', 'Recepción por OC y partida', 'Entrega consolidada al cliente', 'Factura y cierre'];
    /** Grupo de la política de 8 etapas (índice 0 a 7) de cada etapa de 15 (índice 0 a 14). */
    public const GROUP_OF = [0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 4, 5, 6, 7];
    /** Etapa de 15 (índice) según el estatus de la cotización al cliente vigente (QuoteReadRepository::STATUS_KEY). */
    private const QUOTE_STAGE = ['draft' => 6, 'other' => 6, 'superseded' => 6, 'review' => 7, 'authorized' => 8, 'sent' => 9, 'expired' => 9,
        'approved' => 10, 'rejected' => 10, 'change_requested' => 10];
    private const BOTTLENECK_LIMIT = 12;

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
            throw new RuntimeException('PROCESS_FLOW_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    private function count(string $sql, array $binds): int
    {
        return (int) ($this->rows($sql, $binds)[0]['n'] ?? 0);
    }

    /** Mapas por requisición con la MISMA forma que RequisitionRecoveryRepository::associations() usa para stage(). */
    private function associations(int $org): array
    {
        $maps = [];
        $sources = ['rfqs' => 'requisition_id,status_code,legacy_status', 'supplier_quotes' => 'requisition_id,status_code,legacy_status',
            'customer_quote_versions' => 'requisition_id', 'requisition_reviews' => 'requisition_id', 'awards' => 'requisition_id',
            'invoices' => 'requisition_id,status_code,legacy_status'];
        foreach ($sources as $t => $cols) {
            foreach ($this->rows("SELECT {$cols} FROM {$t} WHERE organization_id=? AND requisition_id IS NOT NULL", [$org]) as $row) {
                $maps[$t][(int) $row['requisition_id']][] = $row;
            }
        }
        $pos = $this->rows(<<<'SQL'
            SELECT pr.requisition_id,p.id,p.legacy_status,p.operational_status,
              gr.id AS receipt_id,gr.legacy_received_percent,JSON_UNQUOTE(JSON_EXTRACT(gr.legacy_delivery_snapshot,'$.clientAccept')) AS client_accept
            FROM purchase_order_requisitions pr JOIN purchase_orders p ON p.id=pr.purchase_order_id AND p.organization_id=pr.organization_id
            LEFT JOIN goods_receipts gr ON gr.id=(SELECT MIN(gr0.id) FROM goods_receipts gr0 WHERE gr0.purchase_order_id=p.id AND gr0.organization_id=p.organization_id)
            WHERE pr.organization_id=? AND LOWER(COALESCE(p.legacy_status,p.operational_status,'')) NOT IN ('cancelada','sustituida','cancelled','superseded')
            ORDER BY p.id,gr.id
            SQL, [$org]);
        foreach ($pos as $row) {
            $maps['pos'][(int) $row['requisition_id']][] = $row;
        }
        return $maps;
    }

    /** Valor numérico de organization_settings (grupo legacy_purchasing), o null. */
    private function purchasingSetting(int $org, string $key): ?int
    {
        $row = $this->rows("SELECT settings_json FROM organization_settings WHERE organization_id=? AND settings_group='legacy_purchasing'", [$org])[0] ?? null;
        $json = $row ? json_decode((string) $row['settings_json'], true) : null;
        $v = is_array($json) ? ($json[$key] ?? null) : null;
        return is_numeric($v) && (int) $v > 0 ? (int) $v : null;
    }

    public function overview(int $org): array
    {
        $reqs = $this->rows(<<<'SQL'
            SELECT r.id AS db_id,r.folio,r.request_date,r.route_code,r.history_based,r.latest_change_request_id,e.imported_at,c.legal_name AS client_name,
              EXISTS (SELECT 1 FROM service_orders so WHERE so.organization_id=r.organization_id AND so.requisition_id=r.id) AS has_service
            FROM requisitions r
            JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id AND e.entity_kind='requisition'
            JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            WHERE r.organization_id=? AND e.archived_at IS NULL
            ORDER BY r.request_date,r.id
            SQL, [$org]);
        $maps = $this->associations($org);
        $key = QuoteReadRepository::STATUS_KEY;
        $quoteStage = [];
        foreach ($this->rows("SELECT v.requisition_id,({$key}) AS k FROM customer_quote_versions v WHERE v.organization_id=? AND v.requisition_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM customer_quote_versions nx WHERE nx.organization_id=v.organization_id AND nx.customer_quote_id=v.customer_quote_id AND nx.version_number>v.version_number)", [$org]) as $q) {
            $id = (int) $q['requisition_id'];
            $s = self::QUOTE_STAGE[$q['k']] ?? 6;
            if (!isset($quoteStage[$id]) || $s > $quoteStage[$id]['stage']) {
                $quoteStage[$id] = ['stage' => $s, 'key' => $q['k']];
            }
        }
        $plan = 'sp.organization_id=r.organization_id AND sp.requisition_id=r.id AND NOT EXISTS (SELECT 1 FROM sourcing_plans np WHERE np.organization_id=sp.organization_id AND np.requisition_id=sp.requisition_id AND np.version_number>sp.version_number)';
        $latest = ContractorManagementReadRepository::LATEST_REVIEW;
        $can = ContractorManagementReadRepository::CAN_QUOTE;
        $extra = [];
        foreach ($this->rows(
            "SELECT r.id,(SELECT COUNT(*) FROM sourcing_lots sl JOIN sourcing_plans sp ON sp.id=sl.sourcing_plan_id AND sp.organization_id=sl.organization_id WHERE {$plan}) AS lots,
                    (SELECT GREATEST(COALESCE(sp.min_quotes,0),COALESCE((SELECT MAX(sl.min_quotes) FROM sourcing_lots sl WHERE sl.organization_id=sp.organization_id AND sl.sourcing_plan_id=sp.id),0)) FROM sourcing_plans sp WHERE {$plan}) AS plan_min,
                    (SELECT {$can} FROM requisition_reviews rv WHERE {$latest}) AS can_quote,
                    (SELECT rv.min_quotes FROM requisition_reviews rv WHERE {$latest}) AS review_min,
                    (SELECT COUNT(*) FROM supplier_quotes sq WHERE sq.organization_id=r.organization_id AND sq.requisition_id=r.id) AS offers
             FROM requisitions r WHERE r.organization_id=?", [$org]) as $x) {
            $extra[(int) $x['id']] = $x;
        }
        $defaultMin = $this->purchasingSetting($org, 'minQuotes') ?? 3;

        $p2p = ['stages' => array_fill(0, 15, 0), 'groups' => array_fill(0, 8, 0), 'unmapped' => 0, 'total' => 0];
        $svc = ['groups' => array_fill(0, 8, 0), 'unmapped' => 0, 'total' => 0, 'without_order' => 0];
        $ind = ['rfq_to_issue' => 0, 'insufficient_bids' => 0, 'approved_without_po' => 0];
        $open = [];
        foreach ($reqs as $r) {
            $id = (int) $r['db_id'];
            $g = RequisitionRecoveryRepository::stage($r, $maps);
            $serviceRoute = $r['route_code'] === 'service' || (bool) $r['has_service'];
            if ($serviceRoute) {
                // Requisiciones de la ruta de servicios: su avance se mide con service_orders (Service-to-Cash).
                $svc['total']++;
                $g === null ? $svc['unmapped']++ : $svc['groups'][$g]++;
                if (!$r['has_service']) { $svc['without_order']++; }
                continue;
            }
            $p2p['total']++;
            if ($g === null) {
                $p2p['unmapped']++;
                $open[] = ['r' => $r, 'stage' => null, 'reason' => !empty($r['history_based']) ? 'history' : 'change'];
                continue;
            }
            $p2p['groups'][$g]++;
            $x = $extra[$id] ?? [];
            $min = (int) ($x['plan_min'] ?? 0) ?: ((int) ($x['review_min'] ?? 0) ?: $defaultMin);
            $s = match ($g) {
                0 => 0,
                1 => (int) ($x['lots'] ?? 0) > 0 ? 2 : 1,
                2 => !empty($maps['supplier_quotes'][$id]) ? 4 : 3,
                3 => $quoteStage[$id]['stage'] ?? 5,
                default => $g + 7,
            };
            $p2p['stages'][$s]++;
            $reason = null;
            if ($s === 1 || $s === 2) {
                $reason = (int) ($x['can_quote'] ?? 0) === 1 ? ($s === 1 ? 'lots' : 'rfq') : 'validation_blocked';
                if ($reason !== 'validation_blocked') { $ind['rfq_to_issue']++; }
            } elseif ($s === 3 || $s === 4) {
                $reason = (int) ($x['offers'] ?? 0) < $min ? 'offers' : 'compare';
                if ($reason === 'offers') { $ind['insufficient_bids']++; }
            } elseif ($s === 10) {
                $k = $quoteStage[$id]['key'] ?? '';
                $reason = $k === 'approved' ? 'po' : ($k === 'rejected' ? 'rejected' : 'change_requested');
                if ($k === 'approved') { $ind['approved_without_po']++; }
            } elseif ($s < 14) {
                $reason = ['request', null, null, null, null, 'quote', 'review', 'authorize', 'send', 'decision', null, 'receipt', 'delivery', 'invoice'][$s];
            }
            if ($s < 14) {
                $open[] = ['r' => $r, 'stage' => $s, 'reason' => $reason, 'offers' => (int) ($x['offers'] ?? 0), 'min' => $min];
            }
        }
        $closed = $p2p['stages'][14];

        // ---- Documentos y otros módulos (mismas reglas que Cotizaciones, Recepción y Factura) ----
        $quotes = 'FROM customer_quote_versions v WHERE v.organization_id=?';
        $current = ' AND NOT EXISTS (SELECT 1 FROM customer_quote_versions nx WHERE nx.organization_id=v.organization_id AND nx.customer_quote_id=v.customer_quote_id AND nx.version_number>v.version_number)';
        $byKey = [];
        foreach ($this->rows("SELECT ({$key}) AS k,COUNT(*) AS n {$quotes}{$current} GROUP BY k", [$org]) as $q) {
            $byKey[$q['k']] = (int) $q['n'];
        }
        $poLatest = "NOT EXISTS (SELECT 1 FROM purchase_orders nx WHERE nx.organization_id=po.organization_id AND nx.series_public_id=po.series_public_id AND nx.version_number>po.version_number)
            AND LOWER(COALESCE(po.legacy_status,po.operational_status,'')) NOT IN ('cancelada','sustituida','cancelled','superseded')";
        $reception = new ReceptionReadRepository($this->db);
        $receipts = $reception->matrix($org, ['client' => 'all', 'q' => '', 'kind' => 'receipt', 'page' => 1, 'page_size' => 100000])['items'];
        $deviations = count(array_filter($receipts, static fn ($r) => array_intersect($r['pending_reasons'], ['partial', 'rejected', 'quality', 'documentation']) !== []));
        $receiptsNoDelivery = count(array_filter($receipts, static fn ($r) => (int) $r['delivery_count'] === 0 && !ReceptionReadRepository::isAccepted($r['acceptance'])));
        $poWithoutReceipt = $reception->orders($org, ['q' => '', 'status' => 'all', 'page' => 1, 'page_size' => 1])['summary']['pending'];
        $readyNotInvoiced = count(array_filter($reception->readiness($org), static fn ($r) => $r['ready'] && !$r['invoiced']));
        $analytics = (new AnalyticsReadRepository($this->db))->overview($org, ['from' => '', 'to' => '', 'client' => 'all']);
        $awaiting = ($byKey['sent'] ?? 0) + ($byKey['expired'] ?? 0);
        $currentPos = $this->count("SELECT COUNT(*) AS n FROM purchase_orders po WHERE po.organization_id=? AND {$poLatest}", [$org]);

        $related = [
            $p2p['total'],
            $this->count('SELECT COUNT(*) AS n FROM requisition_reviews WHERE organization_id=?', [$org]),
            $this->count('SELECT COUNT(*) AS n FROM sourcing_lots WHERE organization_id=?', [$org]),
            $this->count('SELECT COUNT(*) AS n FROM rfqs WHERE organization_id=?', [$org]),
            $this->count('SELECT COUNT(*) AS n FROM supplier_quotes WHERE organization_id=?', [$org]),
            $this->count('SELECT COUNT(*) AS n FROM awards WHERE organization_id=? AND superseded_at IS NULL', [$org]),
            $this->count("SELECT COUNT(*) AS n {$quotes}", [$org]),
            $byKey['review'] ?? 0,
            $byKey['authorized'] ?? 0,
            $awaiting,
            ($byKey['approved'] ?? 0) + ($byKey['rejected'] ?? 0) + ($byKey['change_requested'] ?? 0),
            $currentPos,
            $this->count('SELECT COUNT(*) AS n FROM goods_receipts WHERE organization_id=?', [$org]),
            $this->count('SELECT COUNT(*) AS n FROM deliveries WHERE organization_id=?', [$org]),
            $this->count("SELECT COUNT(*) AS n FROM invoices WHERE organization_id=? AND LOWER(COALESCE(legacy_status,status_code,'')) NOT IN ('cancelada','cancelled','cancelado')", [$org]),
        ];

        // ---- Service-to-Cash ----
        $services = (new AnalyticsReadRepository($this->db))->serviceFlow($org);
        $s2c = ['stages' => array_fill(0, 8, 0), 'stage_names' => AnalyticsReadRepository::S2C_STAGES, 'total' => count($services), 'cancelled' => 0, 'pending_auth' => 0,
            'pending_po' => 0, 'executed' => 0, 'ready' => 0, 'invoiced' => 0, 'requisitions_without_order' => $svc['without_order']];
        $svcOpen = [];
        foreach ($services as $x) {
            if ($x['executed']) { $s2c['executed']++; }
            if ($x['invoiced']) { $s2c['invoiced']++; }
            if ($x['ready'] && !$x['invoiced']) { $s2c['ready']++; }
            if ($x['cancelled']) { $s2c['cancelled']++; continue; }
            $s2c['stages'][$x['stage']]++;
            if (!$x['authorized']) { $s2c['pending_auth']++; }
            if ($x['pending_po']) { $s2c['pending_po']++; }
            if ($x['stage'] < 7) { $svcOpen[] = $x; }
        }

        $today = new \DateTimeImmutable('today');
        $days = static function (?string $d) use ($today): ?int {
            if ($d === null || $d === '') { return null; }
            $t = \DateTimeImmutable::createFromFormat('!Y-m-d', substr($d, 0, 10));
            return $t ? (int) $t->diff($today)->format('%r%a') : null;
        };
        usort($open, static fn ($a, $b) => [(string) ($a['r']['request_date'] ?? '9999'), (int) $a['r']['db_id']] <=> [(string) ($b['r']['request_date'] ?? '9999'), (int) $b['r']['db_id']]);
        $p2pList = array_map(static fn ($o) => ['folio' => $o['r']['folio'], 'client_name' => $o['r']['client_name'], 'stage' => $o['stage'] === null ? null : $o['stage'] + 1,
            'reason' => $o['reason'], 'offers' => $o['offers'] ?? null, 'min_offers' => $o['min'] ?? null, 'request_date' => $o['r']['request_date'], 'days' => $days($o['r']['request_date'])],
            array_slice($open, 0, self::BOTTLENECK_LIMIT));
        $svcList = array_map(static fn ($x) => ['folio' => $x['folio'], 'client_name' => $x['client_name'], 'service' => $x['service'], 'stage' => $x['stage'] + 1,
            'reason' => ['link', 'authorization', 'planning', 'supplier_po', 'execution', 'evidence', 'closure'][$x['stage']], 'request_date' => $x['request_date'], 'days' => $days($x['request_date'])],
            array_slice($svcOpen, 0, self::BOTTLENECK_LIMIT));

        return [
            'source' => 'mariadb',
            'p2p' => [
                'stage_names' => self::P2P_STAGES, 'stages' => $p2p['stages'], 'group_of' => self::GROUP_OF,
                'groups' => $p2p['groups'], 'group_names' => RequisitionRecoveryRepository::STAGES, 'unmapped' => $p2p['unmapped'],
                'total' => $p2p['total'], 'open' => $p2p['total'] - $closed, 'closed' => $closed, 'pending_client' => $p2p['stages'][9], 'deviations' => $deviations,
                'service_route' => ['total' => $svc['total'], 'groups' => $svc['groups'], 'unmapped' => $svc['unmapped']],
            ],
            'related' => $related,
            'commercial' => ['pending_rfqs' => (int) $analytics['sourcing']['pending_rfqs'], 'customer_quotes' => $related[6], 'awaiting_client' => $awaiting,
                'approved_without_po' => $ind['approved_without_po'], 'issued_pos' => $currentPos, 'deliveries_without_invoice' => $readyNotInvoiced],
            'special' => ['history_items' => (int) $analytics['repeat']['items'], 'pending_supplier' => (int) $analytics['repeat']['requote'],
                'pending_client_price' => (int) $analytics['repeat']['price_pending'],
                'change_requests' => $this->count('SELECT COUNT(*) AS n FROM requisition_change_requests WHERE organization_id=?', [$org]),
                'po_amendments' => (int) $analytics['po_amendments']['amended_versions']],
            'indicators' => ['rfq_to_issue' => $ind['rfq_to_issue'], 'insufficient_bids' => $ind['insufficient_bids'], 'awaiting_client' => $awaiting,
                'approved_without_po' => $ind['approved_without_po'], 'po_without_receipt' => (int) $poWithoutReceipt, 'receipts_without_delivery' => $receiptsNoDelivery],
            'services' => $s2c,
            'bottlenecks' => ['p2p' => $p2pList, 'p2p_total' => count($open), 'services' => $svcList, 'services_total' => count($svcOpen), 'limit' => self::BOTTLENECK_LIMIT,
                'order' => 'Más antiguos primero (fecha de solicitud).'],
            'min_quotes_default' => $defaultMin,
            'definitions' => [
                'p2p_scope' => 'Requisiciones no archivadas que no son de la ruta de servicios (route_code distinto de service y sin expediente de Servicio Operativo).',
                'p2p_stage' => 'Etapa = la más avanzada con evidencia documental. Afina la política de 8 etapas de la Matriz de requisiciones: 1 Solicitud; 2-3 Validación (3 si el último plan tiene lotes); 4-5 Solicitud de cotización (5 con ofertas); 6-11 Comparativo y autorización (6 sin cotización al cliente; 7 a 11 según el estatus de la cotización vigente: borrador, revisión, autorizada, enviada o vencida, decisión del cliente); 12 OC; 13 Recepción; 14 Entrega y aceptación; 15 Factura.',
                'unmapped' => 'Expedientes desde historial o con control de cambios: la política de etapas no los infiere y se informan sin etapa.',
                'related' => 'Documentos registrados por etapa en toda la organización (cotizaciones al cliente 8 a 11: versión vigente de cada cotización).',
                'pending_client' => 'Requisiciones cuya cotización vigente fue enviada (o venció) sin decisión del cliente.',
                'deviations' => 'Recepciones con avance parcial, partidas rechazadas, calidad no conforme o documentación incompleta (reglas de Recepción y Entrega).',
                'awaiting_client' => 'Cotizaciones al cliente vigentes enviadas o vencidas sin decisión.',
                'deliveries_without_invoice' => 'Requisiciones recibidas al 100 % y aceptadas por el cliente sin factura (regla de Factura).',
                'insufficient_bids' => 'Requisiciones con RFQ y sin adjudicación cuyas ofertas registradas son menos que el mínimo (plan de abastecimiento, validación o parámetro general).',
                'rfq_to_issue' => 'Requisiciones validadas (la última validación permite cotizar) sin RFQ.',
                'po_without_receipt' => 'OC vigentes no canceladas sin recepción (Recepción y Entrega).',
                'receipts_without_delivery' => 'Recepciones sin entrega al cliente ni aceptación registrada.',
                'services' => 'Servicios Operativos (service_orders): mismas 8 etapas y reglas del Dashboard; cancelados fuera de las etapas.',
                'time_in_stage' => 'No se calcula el tiempo en etapa: requiere una regla del original sobre workflow_events.',
            ],
            'read_only' => true,
        ];
    }
}
