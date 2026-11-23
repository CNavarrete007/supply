<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * SupplyFlow v0.6: read-only measures at REQUISITION grain.
 * Multiple documented milestones are NOT mutually exclusive workflow stages.
 * Monetary amounts are never merged across currencies; PO and customer quote
 * monetary aggregates use only the latest version in each series.
 */
final class AnalyticsReadRepository
{
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
            throw new RuntimeException('ANALYTICS_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    private function one(string $sql, array $binds = []): array
    {
        return $this->rows($sql, $binds)[0] ?? [];
    }

    private static function baseFrom(): string
    {
        return ' FROM requisitions r'
            . " JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id AND e.entity_kind='requisition'"
            . ' JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id'
            . " JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'";
    }

    private static function scope(int $organizationId, array $filter, bool $withSearch = false): array
    {
        $conditions = ['r.organization_id=?'];
        $binds = [$organizationId];
        if (($filter['from'] ?? '') !== '') {
            $conditions[] = 'r.request_date>=?';
            $binds[] = $filter['from'];
        }
        if (($filter['to'] ?? '') !== '') {
            $conditions[] = 'r.request_date<=?';
            $binds[] = $filter['to'];
        }
        if (($filter['client'] ?? 'all') !== 'all') {
            $conditions[] = 'ce.public_id=?';
            $binds[] = $filter['client'];
        }
        if ($withSearch && ($filter['q'] ?? '') !== '') {
            $fields = ['r.folio', 'r.description', 'c.legal_name', 'r.requester_name', 'r.project_reference_snapshot', 'r.internal_reference'];
            $conditions[] = '(' . implode(' OR ', array_map(static fn ($f) => $f . " LIKE ? ESCAPE '!'", $fields)) . ')';
            $pattern = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $filter['q']) . '%';
            foreach ($fields as $_) {
                $binds[] = $pattern;
            }
        }
        $milestone = $withSearch ? ($filter['has'] ?? 'all') : 'all';
        if ($milestone !== 'all') {
            $exists = self::milestoneExists($milestone === 'without_purchase_order' ? 'purchase_order' : $milestone);
            $conditions[] = ($milestone === 'without_purchase_order' ? 'NOT ' : '') . $exists;
        }
        return [implode(' AND ', $conditions), $binds];
    }

    /** Hardcoded allowlist: never construct a SQL identifier from untrusted query params. */
    private static function milestoneExists(string $kind): string
    {
        $rules = [
            'rfq' => 'EXISTS (SELECT 1 FROM rfqs f WHERE f.organization_id=r.organization_id AND f.requisition_id=r.id)',
            'supplier_quote' => 'EXISTS (SELECT 1 FROM supplier_quotes sq WHERE sq.organization_id=r.organization_id AND sq.requisition_id=r.id)',
            'customer_quote' => 'EXISTS (SELECT 1 FROM customer_quote_versions qv WHERE qv.organization_id=r.organization_id AND qv.requisition_id=r.id)',
            'purchase_order' => 'EXISTS (SELECT 1 FROM purchase_order_requisitions pr WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id)',
            'receipt' => 'EXISTS (SELECT 1 FROM purchase_order_requisitions pr JOIN goods_receipts gr ON gr.organization_id=pr.organization_id AND gr.purchase_order_id=pr.purchase_order_id WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id)',
            'delivery' => 'EXISTS (SELECT 1 FROM delivery_items di WHERE di.organization_id=r.organization_id AND di.requisition_id=r.id)',
            'invoice' => 'EXISTS (SELECT 1 FROM invoices inv WHERE inv.organization_id=r.organization_id AND inv.requisition_id=r.id)',
        ];
        if (!isset($rules[$kind])) {
            throw new RuntimeException('ANALYTICS_FILTER_UNKNOWN');
        }
        return $rules[$kind];
    }

    private static function intFields(array $row): array
    {
        foreach ($row as $key => $value) {
            if (in_array($key, ['total', 'undated', 'with_rfq', 'with_supplier_quote', 'with_customer_quote',
                'with_purchase_order', 'with_receipt', 'with_delivery', 'with_invoice',
                'requisitions', 'documents', 'line_count', 'rfq_count', 'supplier_quote_count',
                'customer_quote_count', 'purchase_order_count', 'receipt_count', 'delivery_count',
                'invoice_count'], true)) {
                $row[$key] = (int) $value;
            }
        }
        return $row;
    }

    /** Client picker deliberately includes all clients, even those with no requisitions. */
    public function clients(int $org): array
    {
        return $this->rows(<<<'SQL'
            SELECT ce.public_id AS id,c.code,c.legal_name AS name
            FROM clients c
            JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'
            WHERE c.organization_id=? ORDER BY c.legal_name,c.id
            SQL, [$org]);
    }

    public function overview(int $org, array $filter): array
    {
        [$where, $binds] = self::scope($org, $filter);
        $from = self::baseFrom();
        $columns = ['COUNT(*) AS total',
            'COALESCE(SUM(CASE WHEN r.request_date IS NULL THEN 1 ELSE 0 END),0) AS undated'];
        foreach (['rfq','supplier_quote','customer_quote','purchase_order','receipt','delivery','invoice'] as $kind) {
            $columns[] = 'COALESCE(SUM(CASE WHEN ' . self::milestoneExists($kind)
                . ' THEN 1 ELSE 0 END),0) AS with_' . $kind;
        }
        $summary = self::intFields($this->one('SELECT ' . implode(',', $columns) . $from . ' WHERE ' . $where, $binds));
        $monthly = $this->rows('SELECT DATE_FORMAT(r.request_date,\'%Y-%m\') AS period,COUNT(*) AS requisitions'
            . $from . ' WHERE ' . $where . ' AND r.request_date IS NOT NULL'
            . ' GROUP BY DATE_FORMAT(r.request_date,\'%Y-%m\') ORDER BY period DESC LIMIT 24', $binds);
        $monthly = array_reverse(array_map([self::class,'intFields'], $monthly));
        $topClients = array_map([self::class,'intFields'], $this->rows(
            'SELECT ce.public_id AS id,c.legal_name AS name,COUNT(*) AS requisitions'
            . $from . ' WHERE ' . $where . ' GROUP BY ce.public_id,c.legal_name'
            . ' ORDER BY requisitions DESC,c.legal_name LIMIT 8', $binds));
        // A document can relate to more than one requisition. EXISTS avoids multiplying its value.
        $po = $this->moneyByCurrency($org, $where, $binds, 'purchase_orders');
        $quotes = $this->moneyByCurrency($org, $where, $binds, 'customer_quote_versions');
        $budgets = $this->rows('SELECT r.currency_code,COUNT(*) AS documents,'
            . ' COALESCE(SUM(r.budget_amount),0) AS amount'
            . $from . ' WHERE ' . $where . ' AND r.budget_amount IS NOT NULL'
            . ' GROUP BY r.currency_code ORDER BY r.currency_code', $binds);
        $budgets = array_map([self::class,'intFields'], $budgets);
        return [
            'source' => 'mariadb',
            'filters' => $filter,
            'summary' => $summary,
            'monthly' => $monthly,
            'top_clients' => $topClients,
            'financial' => ['requisition_budgets' => $budgets, 'purchase_orders' => $po, 'customer_quotes' => $quotes],
            // Indicadores ampliados (23 nov 2026, solo SELECT): mismos filtros de periodo y cliente.
            'services' => $this->services($org, $filter),
            'service_fee' => $this->serviceFee($org, $where, $binds),
            'supplier_activity' => $this->supplierActivity($org, $where, $binds),
            'repeat' => $this->repeatPricing($where, $binds) + ['client_policies' => $this->clientPolicies($org, $filter)],
            'buyers' => $this->buyers($where, $binds),
            'po_roles' => $this->poRoles($org, $where, $binds),
            'po_amendments' => $this->poAmendments($org, $where, $binds),
            'sourcing' => $this->sourcing($where, $binds),
            'invoices' => $this->moneyByCurrency($org, $where, $binds, 'invoices'),
            'catalogs' => [
                'clients' => (int) ($this->one('SELECT COUNT(*) AS total FROM clients WHERE organization_id=?', [$org])['total'] ?? 0),
                'suppliers' => (int) ($this->one('SELECT COUNT(*) AS total FROM suppliers WHERE organization_id=?', [$org])['total'] ?? 0),
            ],
            'definitions' => [
                'date_basis' => 'Fecha de solicitud (requisitions.request_date); sin fecha queda fuera si se filtra por periodo.',
                'document_grain' => 'Hitos: cantidad de requisiciones con al menos un documento vinculado; no son etapas exclusivas ni documentos totales.',
                'money_basis' => 'Montos guardados, agrupados por moneda. Cotización/OC: última versión de cada serie, contada una sola vez; no son pagos ni ahorro comprobado.',
                'coverage' => 'Documentos retenidos en conciliación sin relación válida no se presentan como vinculados.',
                'trend' => 'Hasta 24 meses con fechas registradas; no se rellenan periodos sin registros.',
                'services' => 'Servicios Operativos (service_orders) por fecha de solicitud del servicio y cliente; etapa Service-to-Cash = primer criterio del Flujo del Proceso que el servicio aún no cumple; cancelados fuera de las etapas.',
                'service_fee' => 'Última versión de cada cotización al cliente de las requisiciones del filtro; Service Fee = service_fee_total_amount con service_fee_enabled; aprobada = estado "Aprobada", decisión del cliente aprobada o decisión registrada.',
                'supplier_activity' => 'Por proveedor: RFQ recibidas, ofertas registradas y partidas adjudicadas vigentes de las requisiciones del filtro; evaluados = proveedores del catálogo con calificación.',
                'repeat' => 'Partidas de requisiciones desde historial: precio fijo (fixed), por recotizar con proveedor (requote) y precio comercial por definir (requote/validate).',
                'po_amendments' => 'Versiones posteriores de OC (version_number > 1) y solicitudes de modificación por estatus; las escrituras siguen bloqueadas.',
                'buyers' => 'Comprador de la validación interna más reciente de cada requisición (usuario o nombre importado); "con OC" = la requisición tiene orden de compra.',
                'po_roles' => 'Última versión de cada OC de las requisiciones del filtro, agrupada por comprador, quien preparó/revisó y quien autorizó (usuarios registrados; vacío = sin asignar).',
                'sourcing' => 'Abastecimiento por lotes (mismas reglas que Gestión del Contratista): por lotificar = última validación permite cotizar, sin plan ni OC; lotificadas = con lotes en su último plan; rutas paralelas = 2 o más lotes; RFQ pendientes = sin oferta registrada ni cancelación.',
            ],
        ];
    }

    private function moneyByCurrency(int $org, string $where, array $binds, string $kind): array
    {
        if ($kind === 'purchase_orders') {
            $sql = 'SELECT po.currency_code,COUNT(*) AS documents,COALESCE(SUM(po.total_amount),0) AS amount'
                . ' FROM purchase_orders po WHERE po.organization_id=?'
                . ' AND NOT EXISTS (SELECT 1 FROM purchase_orders newer WHERE newer.organization_id=po.organization_id'
                . ' AND newer.series_public_id=po.series_public_id AND newer.version_number>po.version_number)'
                . ' AND EXISTS (SELECT 1 FROM purchase_order_requisitions pr'
                . ' JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id'
                . ' JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id'
                . " JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'"
                . ' WHERE pr.purchase_order_id=po.id AND pr.organization_id=po.organization_id AND ' . $where . ')'
                . ' GROUP BY po.currency_code ORDER BY po.currency_code';
        } elseif ($kind === 'customer_quote_versions') {
            $sql = 'SELECT qv.currency_code,COUNT(*) AS documents,COALESCE(SUM(qv.total_amount),0) AS amount'
                . ' FROM customer_quote_versions qv WHERE qv.organization_id=?'
                . ' AND NOT EXISTS (SELECT 1 FROM customer_quote_versions newer WHERE newer.organization_id=qv.organization_id'
                . ' AND newer.customer_quote_id=qv.customer_quote_id AND newer.version_number>qv.version_number)'
                . ' AND EXISTS (SELECT 1 FROM requisitions r'
                . ' JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id'
                . " JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'"
                . ' WHERE r.id=qv.requisition_id AND r.organization_id=qv.organization_id AND ' . $where . ')'
                . ' GROUP BY qv.currency_code ORDER BY qv.currency_code';
        } elseif ($kind === 'invoices') {
            $sql = 'SELECT inv.currency_code,COUNT(*) AS documents,COALESCE(SUM(inv.total_amount),0) AS amount'
                . ' FROM invoices inv WHERE inv.organization_id=?'
                . " AND LOWER(COALESCE(inv.legacy_status,inv.status_code,'')) NOT IN ('cancelada','cancelled','cancelado')"
                . ' AND EXISTS (SELECT 1 FROM requisitions r'
                . ' JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id'
                . " JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'"
                . ' WHERE r.id=inv.requisition_id AND r.organization_id=inv.organization_id AND ' . $where . ')'
                . ' GROUP BY inv.currency_code ORDER BY inv.currency_code';
        } else {
            throw new RuntimeException('UNKNOWN_MONEY_SOURCE');
        }
        return array_map([self::class,'intFields'], $this->rows($sql, [$org, ...$binds]));
    }

    /** Requisitions grain; one row per request, no multiplication through JOINs. */
    private static function fold(?string $v): string
    {
        $v = mb_strtolower(trim((string) $v), 'UTF-8');
        return strtr($v, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
    }

    /** Autorización comercial válida (mismo criterio que el Dashboard de Servicios). */
    private static function authValid(?string $status): bool
    {
        $s = self::fold($status);
        if ($s === '' || preg_match('/rechaz|regulariz|pend/u', $s)) {
            return false;
        }
        return (bool) preg_match('/autoriz|recib|aprob|valid/u', $s);
    }

    public const S2C_STAGES = ['Requisición / solicitud del servicio', 'Autorización comercial del cliente', 'Planeación y programación', 'Proveedor / OC cuando aplique',
        'Ejecución del servicio', 'Evidencia y aceptación', 'Validación y cierre comercial', 'Factura, cobro y cierre'];

    /**
     * Servicios Operativos para el Dashboard principal: portafolio, importes por moneda y etapa Service-to-Cash.
     * La etapa actual es el primer criterio del Flujo del Proceso que el servicio todavía no cumple.
     */
    private function services(int $org, array $filter): array
    {
        $out = ['total' => 0, 'open' => 0, 'executed' => 0, 'invoiced' => 0, 'cancelled' => 0, 'authorized' => 0, 'with_evidence' => 0, 'stages' => array_fill(0, 8, 0), 'money' => []];
        $money = [];
        foreach ($this->serviceRows($org, $filter) as $r) {
            $s = self::serviceState($r);
            $out['total']++;
            if ($s['open']) { $out['open']++; }
            if ($s['executed']) { $out['executed']++; }
            if ($s['invoiced']) { $out['invoiced']++; }
            if ((int) $r['evidence'] > 0) { $out['with_evidence']++; }
            $cur = (string) ($r['currency'] ?? '');
            $money[$cur] ??= ['currency_code' => $cur, 'services' => 0, 'price' => 0.0, 'cost' => 0.0];
            $money[$cur]['services']++;
            $money[$cur]['price'] += (float) $r['price_amount'];
            $money[$cur]['cost'] += (float) $r['cost_amount'];
            if ($s['cancelled']) { $out['cancelled']++; continue; }
            if ($s['authorized']) { $out['authorized']++; }
            $out['stages'][$s['stage']]++;
        }
        ksort($money);
        $out['money'] = array_values(array_map(static fn ($m) => $m + ['margin' => round($m['price'] - $m['cost'], 6)], $money));
        $out['stage_names'] = self::S2C_STAGES;
        return $out;
    }

    /** Servicios (service_orders no archivados) con los datos que deciden su etapa Service-to-Cash. */
    private function serviceRows(int $org, array $filter): array
    {
        $w = ['so.organization_id=?', 'e.archived_at IS NULL'];
        $b = [$org];
        if (($filter['from'] ?? '') !== '') { $w[] = 'so.request_date>=?'; $b[] = $filter['from']; }
        if (($filter['to'] ?? '') !== '') { $w[] = 'so.request_date<=?'; $b[] = $filter['to']; }
        if (($filter['client'] ?? 'all') !== 'all') { $w[] = 'ce.public_id=?'; $b[] = $filter['client']; }
        return $this->rows(
            "SELECT so.folio,c.legal_name AS client_name,COALESCE(st.name,so.legacy_service_type) AS service,
                    COALESCE(NULLIF(TRIM(so.legacy_status),''),so.status_code) AS status,so.requires_supplier,so.supplier_purchase_order_id IS NOT NULL AS has_po,
                    so.requisition_id IS NOT NULL AS has_req,so.request_date,so.required_date,so.authorization_status,so.authorization_type,
                    (so.responsible_user_id IS NOT NULL OR NULLIF(TRIM(so.responsible_snapshot),'') IS NOT NULL) AS has_responsible,
                    so.cost_amount,so.price_amount,so.commercial_currency AS currency,
                    (SELECT COUNT(*) FROM entity_files ef WHERE ef.organization_id=so.organization_id AND ef.entity_id=so.id) AS evidence,
                    EXISTS(SELECT 1 FROM invoices i WHERE i.organization_id=so.organization_id AND i.requisition_id=so.requisition_id
                           AND LOWER(COALESCE(i.legacy_status,i.status_code,'')) NOT IN ('cancelada','cancelled','cancelado')) AS invoiced
             FROM service_orders so
             JOIN business_entities e ON e.id=so.id AND e.organization_id=so.organization_id
             JOIN clients c ON c.id=so.client_id AND c.organization_id=so.organization_id
             JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id
             LEFT JOIN service_types st ON st.id=so.service_type_id AND st.organization_id=so.organization_id
             WHERE " . implode(' AND ', $w) . ' ORDER BY so.request_date,so.id',
            $b
        );
    }

    /**
     * Estado Service-to-Cash de un servicio: la etapa actual (0 a 7) es el primer criterio del Flujo del Proceso que el servicio
     * todavía no cumple; un servicio cancelado no tiene etapa (stage = null).
     */
    public static function serviceState(array $r): array
    {
        $st = self::fold($r['status']);
        $cancelled = str_contains($st, 'cancel');
        $executed = in_array($st, ['completado', 'listo para facturar', 'facturado'], true);
        $invoiced = (bool) $r['invoiced'] || $st === 'facturado';
        $open = !in_array($st, ['completado', 'facturado', 'cancelado'], true) && !$cancelled;
        $auth = self::authValid($r['authorization_status']) || str_contains(self::fold($r['authorization_type']), 'emergencia');
        $planned = in_array($st, ['programado', 'en ejecucion'], true) || $executed || ($r['required_date'] !== null && (bool) $r['has_responsible']);
        $stage = $cancelled ? null : (!$r['has_req'] || $r['request_date'] === null ? 0
            : (!$auth ? 1 : (!$planned ? 2 : ((bool) $r['requires_supplier'] && !$r['has_po'] ? 3 : (!$executed ? 4 : ((int) $r['evidence'] === 0 ? 5 : ($st === 'listo para facturar' || $invoiced ? 7 : 6)))))));
        return ['cancelled' => $cancelled, 'executed' => $executed, 'invoiced' => $invoiced, 'open' => $open, 'authorized' => !$cancelled && $auth,
            'ready' => $st === 'listo para facturar', 'pending_po' => !$cancelled && (bool) $r['requires_supplier'] && !$r['has_po'], 'stage' => $stage];
    }

    /** Flujo del Proceso · ruta Service-to-Cash: cada servicio con su estado (sin filtros). */
    public function serviceFlow(int $org): array
    {
        return array_map(static fn ($r) => ['folio' => $r['folio'], 'client_name' => $r['client_name'], 'service' => $r['service'], 'status' => $r['status'],
            'request_date' => $r['request_date']] + self::serviceState($r), $this->serviceRows($org, []));
    }

    /** Cotización + Service Fee: última versión de cada cotización al cliente de las requisiciones del filtro. */
    private function serviceFee(int $org, string $where, array $binds): array
    {
        $approved = "(qv.legacy_status='Aprobada' OR qv.client_decision_status IN ('approved','approved_legacy')
            OR EXISTS (SELECT 1 FROM customer_quote_decisions d WHERE d.organization_id=qv.organization_id AND d.customer_quote_version_id=qv.id AND d.decision_code='approved'))";
        $rows = $this->rows(
            'SELECT qv.currency_code,COUNT(*) AS versions,COALESCE(SUM(qv.service_fee_enabled=1),0) AS with_fee,'
            . ' COALESCE(SUM(CASE WHEN qv.service_fee_enabled=1 THEN qv.service_fee_total_amount END),0) AS fee_amount,'
            . " COALESCE(SUM({$approved}),0) AS approved,COALESCE(SUM(qv.service_fee_enabled=1 AND {$approved}),0) AS approved_with_fee"
            . ' FROM customer_quote_versions qv WHERE qv.organization_id=?'
            . ' AND NOT EXISTS (SELECT 1 FROM customer_quote_versions newer WHERE newer.organization_id=qv.organization_id'
            . ' AND newer.customer_quote_id=qv.customer_quote_id AND newer.version_number>qv.version_number)'
            . ' AND EXISTS (SELECT 1 FROM requisitions r'
            . ' JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id'
            . " JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'"
            . ' WHERE r.id=qv.requisition_id AND r.organization_id=qv.organization_id AND ' . $where . ')'
            . ' GROUP BY qv.currency_code ORDER BY qv.currency_code',
            [$org, ...$binds]
        );
        $total = ['versions' => 0, 'with_fee' => 0, 'approved' => 0, 'approved_with_fee' => 0];
        foreach ($rows as &$r) {
            foreach (['versions', 'with_fee', 'approved', 'approved_with_fee'] as $k) { $r[$k] = (int) $r[$k]; $total[$k] += $r[$k]; }
            $r['fee_amount'] = (float) $r['fee_amount'];
        }
        unset($r);
        return $total + ['by_currency' => $rows];
    }

    /** Proveedores con mayor actividad: RFQ, ofertas y partidas adjudicadas vigentes (top 8). */
    private function supplierActivity(int $org, string $where, array $binds): array
    {
        $from = self::baseFrom();
        $acc = [];
        $sources = [
            'rfqs' => ' JOIN rfqs x ON x.requisition_id=r.id AND x.organization_id=r.organization_id',
            'quotes' => ' JOIN supplier_quotes x ON x.requisition_id=r.id AND x.organization_id=r.organization_id',
            'awards' => " JOIN awards x ON x.requisition_id=r.id AND x.organization_id=r.organization_id AND x.status_code='active' AND x.superseded_at IS NULL",
        ];
        foreach ($sources as $k => $join) {
            foreach ($this->rows('SELECT x.supplier_id,COUNT(*) AS n' . $from . $join . ' WHERE ' . $where . ' GROUP BY x.supplier_id', $binds) as $r) {
                $acc[(int) $r['supplier_id']] ??= ['rfqs' => 0, 'quotes' => 0, 'awards' => 0];
                $acc[(int) $r['supplier_id']][$k] = (int) $r['n'];
            }
        }
        $evaluated = (int) ($this->one('SELECT COUNT(*) AS n FROM suppliers s JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id'
            . ' WHERE s.organization_id=? AND se.archived_at IS NULL AND s.rating IS NOT NULL AND s.rating>0', [$org])['n'] ?? 0);
        if ($acc === []) {
            return ['suppliers' => [], 'active_suppliers' => 0, 'evaluated' => $evaluated];
        }
        uasort($acc, static fn ($a, $b) => [$b['awards'], $b['quotes'], $b['rfqs']] <=> [$a['awards'], $a['quotes'], $a['rfqs']]);
        $top = array_slice($acc, 0, 8, true);
        $ids = array_keys($top);
        $names = [];
        foreach ($this->rows('SELECT s.id,se.public_id,s.legal_name FROM suppliers s JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id'
            . ' WHERE s.organization_id=? AND s.id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')', [$org, ...$ids]) as $r) {
            $names[(int) $r['id']] = [$r['public_id'], $r['legal_name']];
        }
        $out = [];
        foreach ($top as $id => $c) {
            $out[] = ['id' => $names[$id][0] ?? null, 'name' => $names[$id][1] ?? '—'] + $c;
        }
        return ['suppliers' => $out, 'active_suppliers' => count($acc), 'evaluated' => $evaluated];
    }

    /** Recompra: partidas de requisiciones desde historial por tratamiento de precio y abastecimiento. */
    private function repeatPricing(string $where, array $binds): array
    {
        $r = $this->one(
            "SELECT COUNT(*) AS items,
                    COALESCE(SUM(LOWER(COALESCE(i.repeat_client_price_mode,''))='fixed' OR i.fixed_client_price=1),0) AS honored,
                    COALESCE(SUM(LOWER(COALESCE(i.repeat_sourcing_mode,''))='requote'),0) AS requote,
                    COALESCE(SUM(LOWER(COALESCE(i.repeat_client_price_mode,'')) IN ('requote','validate')),0) AS price_pending"
            . self::baseFrom() . ' JOIN requisition_items i ON i.requisition_id=r.id AND i.organization_id=r.organization_id'
            . " WHERE {$where} AND (i.history_based=1 OR r.history_based=1) AND COALESCE(i.line_status,'active')<>'cancelled'",
            $binds
        );
        $out = array_map('intval', ['items' => $r['items'] ?? 0, 'honored' => $r['honored'] ?? 0, 'requote' => $r['requote'] ?? 0, 'price_pending' => $r['price_pending'] ?? 0]);
        foreach (['price_modes' => 'i.repeat_client_price_mode', 'sourcing_modes' => 'i.repeat_sourcing_mode'] as $key => $col) {
            $out[$key] = array_map(static fn ($x) => ['code' => (string) $x['code'], 'n' => (int) $x['n']], $this->rows(
                "SELECT LOWER(COALESCE(NULLIF(TRIM({$col}),''),'')) AS code,COUNT(*) AS n" . self::baseFrom()
                . ' JOIN requisition_items i ON i.requisition_id=r.id AND i.organization_id=r.organization_id'
                . " WHERE {$where} AND (i.history_based=1 OR r.history_based=1) AND COALESCE(i.line_status,'active')<>'cancelled' GROUP BY 1 ORDER BY n DESC,code",
                $binds
            ));
        }
        return $out;
    }

    /** Políticas de recompra de los clientes (filtro de cliente; no depende del periodo). */
    private function clientPolicies(int $org, array $filter): array
    {
        $w = 'c.organization_id=?'; $b = [$org];
        if (($filter['client'] ?? 'all') !== 'all') { $w .= ' AND ce.public_id=?'; $b[] = $filter['client']; }
        $from = " FROM clients c JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client' WHERE {$w}";
        $out = [];
        foreach (['sales' => 'c.repeat_sales_policy', 'sourcing' => 'c.repeat_sourcing_policy'] as $key => $col) {
            $out[$key] = array_map(static fn ($x) => ['code' => (string) $x['code'], 'n' => (int) $x['n']],
                $this->rows("SELECT COALESCE(NULLIF(TRIM({$col}),''),'') AS code,COUNT(*) AS n{$from} GROUP BY 1 ORDER BY n DESC,code", $b));
        }
        $out['clients'] = (int) ($this->one("SELECT COUNT(*) AS n{$from}", $b)['n'] ?? 0);
        return $out;
    }

    /** Dashboard de compradores (requisiciones): comprador de la validación interna más reciente (Gestión del Contratista). */
    private function buyers(string $where, array $binds): array
    {
        $latest = ContractorManagementReadRepository::LATEST_REVIEW;
        $buyer = ContractorManagementReadRepository::buyer('rv');
        $rows = $this->rows(
            "SELECT COALESCE(NULLIF(TRIM({$buyer}),''),'') AS name,COUNT(*) AS requisitions,"
            . ' COALESCE(SUM(EXISTS (SELECT 1 FROM purchase_order_requisitions pr WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id)),0) AS with_po'
            . self::baseFrom() . " JOIN requisition_reviews rv ON {$latest} WHERE {$where} GROUP BY 1 ORDER BY requisitions DESC,name LIMIT 8",
            $binds
        );
        $validated = (int) ($this->one('SELECT COUNT(*) AS n' . self::baseFrom() . " JOIN requisition_reviews rv ON {$latest} WHERE {$where}", $binds)['n'] ?? 0);
        return ['items' => array_map(static fn ($x) => ['name' => $x['name'], 'requisitions' => (int) $x['requisitions'], 'with_po' => (int) $x['with_po']], $rows), 'validated' => $validated];
    }

    /** Segregación de funciones de OC (última versión de cada OC del filtro): comprador, preparó/revisó y autorizó. */
    private function poRoles(int $org, string $where, array $binds): array
    {
        $scope = ' AND NOT EXISTS (SELECT 1 FROM purchase_orders newer WHERE newer.organization_id=po.organization_id AND newer.series_public_id=po.series_public_id AND newer.version_number>po.version_number)'
            . ' AND EXISTS (SELECT 1 FROM purchase_order_requisitions pr'
            . ' JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id'
            . ' JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id'
            . " JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'"
            . ' WHERE pr.purchase_order_id=po.id AND pr.organization_id=po.organization_id AND ' . $where . ')';
        $out = [];
        foreach (['buyer' => 'po.buyer_user_id', 'preparer' => 'po.preparer_user_id', 'authorizer' => 'po.authorizer_user_id'] as $key => $col) {
            $name = "(SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id={$col} AND u.organization_id=po.organization_id)";
            $out[$key] = array_map(static fn ($x) => ['name' => (string) $x['name'], 'orders' => (int) $x['orders']], $this->rows(
                "SELECT COALESCE({$name},'') AS name,COUNT(*) AS orders FROM purchase_orders po WHERE po.organization_id=?{$scope} GROUP BY 1 ORDER BY orders DESC,name LIMIT 6",
                [$org, ...$binds]
            ));
        }
        return $out;
    }

    /** Enmiendas de OC: versiones posteriores y solicitudes de modificación de las OC del filtro (solo conteo). */
    private function poAmendments(int $org, string $where, array $binds): array
    {
        $scope = ' AND EXISTS (SELECT 1 FROM purchase_order_requisitions pr'
            . ' JOIN requisitions r ON r.id=pr.requisition_id AND r.organization_id=pr.organization_id'
            . ' JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id'
            . " JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id AND ce.entity_kind='client'"
            . ' WHERE pr.purchase_order_id=po.id AND pr.organization_id=po.organization_id AND ' . $where . ')';
        $versions = (int) ($this->one('SELECT COUNT(*) AS n FROM purchase_orders po WHERE po.organization_id=? AND po.version_number>1' . $scope, [$org, ...$binds])['n'] ?? 0);
        $requests = $this->rows('SELECT m.status_code AS status,COUNT(*) AS n FROM purchase_order_modification_requests m'
            . ' JOIN purchase_orders po ON po.id=m.purchase_order_id AND po.organization_id=m.organization_id'
            . ' WHERE m.organization_id=?' . $scope . ' GROUP BY m.status_code ORDER BY m.status_code', [$org, ...$binds]);
        foreach ($requests as &$q) { $q['n'] = (int) $q['n']; }
        unset($q);
        return ['amended_versions' => $versions, 'requests' => $requests, 'requests_total' => array_sum(array_column($requests, 'n'))];
    }

    /** Abastecimiento por lotes y rutas paralelas (requisiciones del filtro; reglas de Gestión del Contratista). */
    private function sourcing(string $where, array $binds): array
    {
        $latest = ContractorManagementReadRepository::LATEST_REVIEW;
        $can = ContractorManagementReadRepository::CAN_QUOTE;
        $plan = 'sp.organization_id=r.organization_id AND sp.requisition_id=r.id AND NOT EXISTS (SELECT 1 FROM sourcing_plans np WHERE np.organization_id=sp.organization_id AND np.requisition_id=sp.requisition_id AND np.version_number>sp.version_number)';
        $lots = "(SELECT COUNT(*) FROM sourcing_lots sl JOIN sourcing_plans sp ON sp.id=sl.sourcing_plan_id AND sp.organization_id=sl.organization_id WHERE {$plan})";
        $r = $this->one(
            'SELECT COALESCE(SUM(' . "EXISTS (SELECT 1 FROM requisition_reviews rv WHERE {$latest} AND {$can})"
            . ' AND NOT EXISTS (SELECT 1 FROM sourcing_plans sp0 WHERE sp0.organization_id=r.organization_id AND sp0.requisition_id=r.id)'
            . ' AND NOT EXISTS (SELECT 1 FROM purchase_order_requisitions pr WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id)),0) AS to_batch,'
            . " COALESCE(SUM({$lots}>0),0) AS batched,COALESCE(SUM({$lots}>1),0) AS parallel"
            . self::baseFrom() . ' WHERE ' . $where,
            $binds
        );
        $items = $this->one('SELECT COUNT(DISTINCT ri.requisition_item_id) AS n' . self::baseFrom()
            . ' JOIN rfqs f ON f.requisition_id=r.id AND f.organization_id=r.organization_id JOIN rfq_items ri ON ri.rfq_id=f.id AND ri.organization_id=f.organization_id WHERE ' . $where, $binds);
        $suppliers = $this->one('SELECT COUNT(DISTINCT ls.supplier_id) AS n' . self::baseFrom()
            . ' JOIN sourcing_lots sl ON sl.requisition_id=r.id AND sl.organization_id=r.organization_id'
            . ' JOIN sourcing_lot_suppliers ls ON ls.sourcing_lot_id=sl.id AND ls.organization_id=sl.organization_id AND ls.selected=1 WHERE ' . $where, $binds);
        $pending = $this->one('SELECT COUNT(*) AS n' . self::baseFrom() . ' JOIN rfqs f ON f.requisition_id=r.id AND f.organization_id=r.organization_id WHERE ' . $where
            . " AND LOWER(COALESCE(f.legacy_status,f.status_code,'')) NOT LIKE 'cancel%'"
            . ' AND NOT EXISTS (SELECT 1 FROM supplier_quotes sq WHERE sq.organization_id=f.organization_id AND sq.rfq_id=f.id)', $binds);
        return ['to_batch' => (int) ($r['to_batch'] ?? 0), 'batched' => (int) ($r['batched'] ?? 0), 'items_with_rfq' => (int) ($items['n'] ?? 0),
            'assigned_suppliers' => (int) ($suppliers['n'] ?? 0), 'pending_rfqs' => (int) ($pending['n'] ?? 0), 'parallel' => (int) ($r['parallel'] ?? 0)];
    }

    public function report(int $org, array $filter, int $page, int $size): array
    {
        [$where,$binds] = self::scope($org, $filter, true);
        $from = self::baseFrom();
        $columns = ['COUNT(*) AS total'];
        foreach (['rfq','supplier_quote','customer_quote','purchase_order','receipt','delivery','invoice'] as $kind) {
            $columns[] = 'COALESCE(SUM(CASE WHEN ' . self::milestoneExists($kind)
                . ' THEN 1 ELSE 0 END),0) AS with_' . $kind;
        }
        $summary = self::intFields($this->one('SELECT ' . implode(',', $columns) . $from . ' WHERE ' . $where, $binds));
        $total = (int) ($summary['total'] ?? 0);
        $budgets = array_map([self::class, 'intFields'], $this->rows(
            'SELECT r.currency_code,COUNT(*) AS documents,COALESCE(SUM(r.budget_amount),0) AS amount'
            . $from . ' WHERE ' . $where . ' AND r.budget_amount IS NOT NULL'
            . ' GROUP BY r.currency_code ORDER BY r.currency_code', $binds));
        $sql = <<<'SQL'
            SELECT e.public_id AS id,r.folio,c.legal_name AS client_name,
            r.project_reference_snapshot AS project,r.request_date,r.need_date,
            r.currency_code,r.budget_amount,r.description,
            (SELECT COUNT(*) FROM requisition_items li WHERE li.organization_id=r.organization_id AND li.requisition_id=r.id) AS line_count,
            (SELECT COUNT(*) FROM rfqs f WHERE f.organization_id=r.organization_id AND f.requisition_id=r.id) AS rfq_count,
            (SELECT COUNT(*) FROM supplier_quotes sq WHERE sq.organization_id=r.organization_id AND sq.requisition_id=r.id) AS supplier_quote_count,
            (SELECT COUNT(*) FROM customer_quote_versions qv WHERE qv.organization_id=r.organization_id AND qv.requisition_id=r.id) AS customer_quote_count,
            (SELECT COUNT(DISTINCT pr.purchase_order_id) FROM purchase_order_requisitions pr WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id) AS purchase_order_count,
            (SELECT COUNT(DISTINCT gr.id) FROM purchase_order_requisitions pr JOIN goods_receipts gr ON gr.organization_id=pr.organization_id AND gr.purchase_order_id=pr.purchase_order_id WHERE pr.organization_id=r.organization_id AND pr.requisition_id=r.id) AS receipt_count,
            (SELECT COUNT(DISTINCT di.delivery_id) FROM delivery_items di WHERE di.organization_id=r.organization_id AND di.requisition_id=r.id) AS delivery_count,
            (SELECT COUNT(*) FROM invoices inv WHERE inv.organization_id=r.organization_id AND inv.requisition_id=r.id) AS invoice_count
            SQL;
        $data = $this->rows($sql . $from . ' WHERE ' . $where
            . ' ORDER BY COALESCE(r.request_date,DATE(e.created_at)) DESC,r.id DESC LIMIT ? OFFSET ?',
            [...$binds, $size, ($page - 1) * $size]);
        return [
            'source' => 'mariadb',
            'filters' => $filter,
            'total' => $total,
            'summary' => $summary,
            'budgets' => $budgets,
            'page' => $page,
            'page_size' => $size,
            'items' => array_map([self::class,'intFields'], $data),
            'notes' => [
                'Solo montos presupuestados por requisición; NULL es desconocido, no cero.',
                'Contadores de documentos vinculados, incluyendo revisiones donde existan; no son estados ni certificados de cierre.',
                'No se suman importes de monedas diferentes y no se calculan ahorros sin comparables.',
            ],
        ];
    }
}
