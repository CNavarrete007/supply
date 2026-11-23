<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

/**
 * Servicios Operativos · read-only (SELECT). Section 3 "Matriz de servicios": service orders (`service_orders`) with their
 * requisition, type, client, authorization, supplier PO, billing, status, quantity, cost / sale / margin, responsible and
 * evidence count; cards by client and by buyer (the buyer of the latest internal validation of the linked requisition,
 * "Gestión del Contratista"). Every query is scoped to the session organization; archived records are excluded.
 * Registering, editing or deleting services is NOT exposed (no write routes).
 */
final class ServiceReadRepository
{
    private BaseConnection $db;

    public function __construct(?BaseConnection $connection = null)
    {
        $this->db = $connection ?? Database::connect();
    }

    /** @return list<array<string,mixed>> */
    private function rows(string $sql, array $binds = []): array
    {
        $q = $this->db->query($sql, $binds);
        if ($q === false) {
            throw new \RuntimeException('Query failed');
        }
        return $q->getResultArray();
    }

    private static function snapName(string $col): string
    {
        return "(CASE WHEN {$col} IS NULL OR NOT JSON_VALID({$col}) THEN NULL WHEN JSON_TYPE({$col})='STRING' THEN JSON_UNQUOTE({$col}) ELSE COALESCE(JSON_VALUE({$col},'$.name'),JSON_VALUE({$col},'$.display_name'),JSON_VALUE({$col},'$.nombre')) END)";
    }

    /** Status label shown and filtered: the original Apps Script status when present, else the code. */
    private const STATUS = "COALESCE(NULLIF(TRIM(so.legacy_status),''),so.status_code)";
    private const CLOSED = "('Completado','Facturado','Cancelado','completed','invoiced','cancelled')";
    private const DONE = "('Completado','Facturado','completed','invoiced')";

    /** One row per service with every computed column (derived table V). */
    private function base(): string
    {
        $st = self::STATUS;
        $snap = self::snapName('rv.buyer_snapshot');
        $rv = "SELECT rv.id FROM requisition_reviews rv WHERE rv.organization_id=so.organization_id AND rv.requisition_id=so.requisition_id ORDER BY rv.id DESC LIMIT 1";
        $buyerName = "(SELECT COALESCE((SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=rv.buyer_user_id AND u.organization_id=rv.organization_id),{$snap}) FROM requisition_reviews rv WHERE rv.id=({$rv}))";
        $buyerKey = "(SELECT CASE WHEN rv.buyer_user_id IS NOT NULL THEN CONVERT((SELECT u.public_id FROM users u WHERE u.id=rv.buyer_user_id AND u.organization_id=rv.organization_id) USING utf8mb4)
                       WHEN {$snap} IS NOT NULL AND TRIM({$snap})<>'' THEN CONCAT('legacy-',LEFT(SHA2(TRIM({$snap}),256),16)) END FROM requisition_reviews rv WHERE rv.id=({$rv}))";
        return <<<SQL
            SELECT so.id AS so_id,e.public_id AS id,so.folio,re.public_id AS requisition_id,r.folio AS requisition,so.internal_reference,
                   COALESCE(stp.name,so.legacy_service_type) AS service,ce.public_id AS client_id,c.legal_name AS client_name,
                   COALESCE(so.project_reference_snapshot,r.project_reference_snapshot) AS project,so.request_date AS date,so.required_date,
                   so.authorization_type,so.authorization_status,so.authorization_reference,so.authorization_date,
                   so.requires_supplier,po.folio AS supplier_po,sup.legal_name AS supplier_name,
                   {$st} AS status,so.status_code,so.quantity,so.unit_label,so.cost_amount AS cost,so.price_amount AS price,so.commercial_currency AS currency,
                   COALESCE((SELECT p.display_name FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.id=so.responsible_user_id AND u.organization_id=so.organization_id),so.responsible_snapshot) AS responsible,
                   (SELECT COUNT(*) FROM entity_files ef WHERE ef.organization_id=so.organization_id AND ef.entity_id=so.id) AS evidence_count,
                   (SELECT GROUP_CONCAT(i.folio ORDER BY i.folio SEPARATOR ', ') FROM invoices i WHERE i.organization_id=so.organization_id AND i.requisition_id=so.requisition_id
                      AND LOWER(COALESCE(i.legacy_status,i.status_code,'')) NOT IN ('cancelada','cancelled','cancelado')) AS invoices,
                   COALESCE({$buyerKey},'unassigned') AS buyer_key,{$buyerName} AS buyer,
                   ({$st} NOT IN {$this->closed()}) AS is_open,({$st} IN {$this->done()}) AS is_done,
                   (e.imported_at IS NOT NULL OR e.legacy_id IS NOT NULL) AS imported
            FROM service_orders so
            JOIN business_entities e ON e.id=so.id AND e.organization_id=so.organization_id
            JOIN clients c ON c.id=so.client_id AND c.organization_id=so.organization_id
            JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id
            LEFT JOIN requisitions r ON r.id=so.requisition_id AND r.organization_id=so.organization_id
            LEFT JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
            LEFT JOIN service_types stp ON stp.id=so.service_type_id AND stp.organization_id=so.organization_id
            LEFT JOIN purchase_orders po ON po.id=so.supplier_purchase_order_id AND po.organization_id=so.organization_id
            LEFT JOIN suppliers sup ON sup.id=so.supplier_id AND sup.organization_id=so.organization_id
            WHERE so.organization_id=? AND e.archived_at IS NULL
            SQL;
    }

    private function closed(): string { return self::CLOSED; }
    private function done(): string { return self::DONE; }

    /** @param array{client:string,buyer:string,service:string,status:string,q:string,from?:string,to?:string,page:int,page_size:int} $f (from/to: request date range, section 4 Reportes) */
    public function matrix(int $org, array $f): array
    {
        $base = $this->base();
        $w = ''; $b = [$org];
        if ($f['service'] !== '') { $w .= ' AND V.service=?'; $b[] = $f['service']; }
        if ($f['status'] !== '') { $w .= ' AND V.status=?'; $b[] = $f['status']; }
        if (($f['from'] ?? '') !== '') { $w .= ' AND V.date>=?'; $b[] = $f['from']; }
        if (($f['to'] ?? '') !== '') { $w .= ' AND V.date<=?'; $b[] = $f['to']; }
        if ($f['q'] !== '') {
            $l = '%' . strtr($f['q'], ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
            $w .= " AND (V.folio LIKE ? ESCAPE '!' OR V.requisition LIKE ? ESCAPE '!' OR V.internal_reference LIKE ? ESCAPE '!' OR V.client_name LIKE ? ESCAPE '!' OR V.project LIKE ? ESCAPE '!' OR V.authorization_reference LIKE ? ESCAPE '!' OR V.responsible LIKE ? ESCAPE '!')";
            array_push($b, $l, $l, $l, $l, $l, $l, $l);
        }
        $clients = $this->rows("SELECT V.client_id AS id,MAX(V.client_name) AS name,GROUP_CONCAT(DISTINCT V.project ORDER BY V.project SEPARATOR ', ') AS projects,COUNT(*) AS services,
                COUNT(DISTINCT V.buyer_key) AS buyers,SUM(V.is_open) AS open,SUM(V.evidence_count>0) AS with_evidence FROM ({$base}) V WHERE 1=1{$w} GROUP BY V.client_id ORDER BY name", $b);
        foreach ($clients as &$c) {
            foreach (['services', 'buyers', 'open', 'with_evidence'] as $k) {
                $c[$k] = (int) $c[$k];
            }
        }
        unset($c);
        $buyers = [];
        if ($f['client'] !== 'all') {
            $buyers = $this->rows("SELECT V.buyer_key AS `key`,MAX(V.buyer) AS name,GROUP_CONCAT(DISTINCT V.requisition ORDER BY V.requisition SEPARATOR ', ') AS requisitions,COUNT(*) AS services,
                    SUM(V.is_open) AS open,SUM(V.is_done) AS completed,COUNT(DISTINCT V.service) AS types FROM ({$base}) V WHERE V.client_id=?{$w} GROUP BY V.buyer_key ORDER BY V.buyer_key='unassigned',name",
                [$org, $f['client'], ...array_slice($b, 1)]);
            foreach ($buyers as &$x) {
                foreach (['services', 'open', 'completed', 'types'] as $k) {
                    $x[$k] = (int) $x[$k];
                }
            }
            unset($x);
        }
        $iw = $w; $ib = $b;
        if ($f['client'] !== 'all') { $iw .= ' AND V.client_id=?'; $ib[] = $f['client']; }
        if ($f['buyer'] !== 'all') { $iw .= ' AND V.buyer_key=?'; $ib[] = $f['buyer']; }
        $total = (int) ($this->rows("SELECT COUNT(*) AS n FROM ({$base}) V WHERE 1=1{$iw}", $ib)[0]['n'] ?? 0);
        $size = $f['page_size']; $off = ($f['page'] - 1) * $size;
        $items = $this->rows("SELECT V.* FROM ({$base}) V WHERE 1=1{$iw} ORDER BY COALESCE(V.date,'0000-01-01') DESC,V.so_id DESC LIMIT {$size} OFFSET {$off}", $ib);
        foreach ($items as &$x) {
            unset($x['so_id']);
            foreach (['quantity', 'cost', 'price'] as $k) {
                $x[$k] = $x[$k] === null ? null : (float) $x[$k];
            }
            $x['margin'] = $x['price'] === null || $x['cost'] === null ? null : round($x['price'] - $x['cost'], 6);
            $x['evidence_count'] = (int) $x['evidence_count'];
            foreach (['requires_supplier', 'is_open', 'is_done', 'imported'] as $k) {
                $x[$k] = (bool) $x[$k];
            }
        }
        unset($x);
        $types = array_column($this->rows('SELECT DISTINCT name FROM (SELECT name FROM service_types WHERE organization_id=? AND active=1 UNION SELECT legacy_service_type FROM service_orders WHERE organization_id=?) t WHERE name IS NOT NULL AND TRIM(name)<>\'\' ORDER BY name', [$org, $org]), 'name');
        $statuses = array_column($this->rows('SELECT DISTINCT ' . self::STATUS . ' AS s FROM service_orders so WHERE so.organization_id=? ORDER BY s', [$org]), 's');
        return ['items' => $items, 'total' => $total, 'page' => $f['page'], 'page_size' => $size,
            'summary' => ['clients' => $clients, 'buyers' => $buyers, 'services' => array_sum(array_column($clients, 'services'))],
            'service_types' => $types, 'statuses' => $statuses];
    }

    /** Service request (expediente) for the "Solicitud" view: header, operational details and evidence metadata. */
    public function service(int $org, string $id): ?array
    {
        $base = $this->base();
        $x = $this->rows("SELECT V.* FROM ({$base}) V WHERE V.id=?", [$org, $id])[0] ?? null;
        if (! $x) {
            return null;
        }
        $so = $this->rows('SELECT description,notes,authorization_amount,authorization_currency,authorization_valid_until,contract_reference_snapshot AS contract,detail_schema_code,details_json FROM service_orders WHERE id=? AND organization_id=?', [$x['so_id'], $org])[0] ?? [];
        $files = $this->rows('SELECT ef.file_role AS role,ef.original_filename AS name,COALESCE(ef.declared_mime,f.detected_mime) AS mime,COALESCE(ef.declared_size_bytes,f.size_bytes) AS size_bytes,f.scan_status,ef.created_at
            FROM entity_files ef JOIN files f ON f.id=ef.file_id AND f.organization_id=ef.organization_id WHERE ef.organization_id=? AND ef.entity_id=? ORDER BY ef.created_at,ef.id', [$org, $x['so_id']]);
        unset($x['so_id']);
        foreach (['quantity', 'cost', 'price'] as $k) {
            $x[$k] = $x[$k] === null ? null : (float) $x[$k];
        }
        $x['margin'] = $x['price'] === null || $x['cost'] === null ? null : round($x['price'] - $x['cost'], 6);
        $x['evidence_count'] = (int) $x['evidence_count'];
        foreach (['requires_supplier', 'is_open', 'is_done', 'imported'] as $k) {
            $x[$k] = (bool) $x[$k];
        }
        $details = isset($so['details_json']) ? json_decode((string) $so['details_json'], true) : null;
        unset($so['details_json']);
        $so['authorization_amount'] = isset($so['authorization_amount']) ? (float) $so['authorization_amount'] : null;
        foreach ($files as &$fl) {
            $fl['size_bytes'] = $fl['size_bytes'] === null ? null : (int) $fl['size_bytes'];
        }
        unset($fl);
        return ['item' => $x + $so, 'details' => is_array($details) ? $details : [], 'files' => $files];
    }

    /*
     * Sección 2 "Nueva solicitud" (asistente Operación → Servicio → Requisición). SOLO LECTURA: catálogo de tipos de
     * servicio, la referencia interna sugerida y la disponibilidad de folio / referencia. No crea requisiciones ni
     * expedientes: el alta de la requisición maestra de servicio (route_code 'service') no tiene endpoint autorizado.
     */

    /** @return array<string,mixed> */
    public function newRequestCatalog(int $org): array
    {
        $types = $this->rows(
            'SELECT st.code,st.name,st.active,
                    (SELECT COUNT(*) FROM requisitions r WHERE r.organization_id=st.organization_id AND r.service_type_id=st.id) AS requisitions,
                    (SELECT COUNT(*) FROM service_orders so WHERE so.organization_id=st.organization_id AND so.service_type_id=st.id) AS services
             FROM service_types st WHERE st.organization_id=? ORDER BY st.name,st.id',
            [$org]
        );
        foreach ($types as &$t) {
            $t['active'] = (bool) $t['active'];
            $t['requisitions'] = (int) $t['requisitions'];
            $t['services'] = (int) $t['services'];
        }
        unset($t);
        $distinct = fn (string $col): array => array_values(array_filter(array_map(
            fn ($r) => trim((string) $r['v']),
            $this->rows("SELECT DISTINCT {$col} AS v FROM service_orders WHERE organization_id=? AND {$col} IS NOT NULL AND TRIM({$col})<>'' ORDER BY v", [$org])
        ), fn ($v) => $v !== ''));
        // Folio del expediente SRV-AÑO-00000: mayor secuencia registrada por año (el folio se asigna al guardar).
        $seq = [];
        foreach ($this->rows("SELECT folio FROM service_orders WHERE organization_id=? AND folio REGEXP '^SRV-[0-9]{4}-[0-9]+$'", [$org]) as $r) {
            [, $y, $n] = explode('-', strtoupper((string) $r['folio']));
            $seq[$y] = max($seq[$y] ?? 0, (int) $n);
        }
        ksort($seq);
        return [
            'service_types' => $types,
            'authorization_types' => $distinct('authorization_type'),
            'authorization_statuses' => $distinct('authorization_status'),
            'statuses' => $distinct('legacy_status'),
            'service_folio_sequences' => (object) $seq,
            'reference_rule' => 'SRV-{PROYECTO}-{AÑO}-{0000}',
            'folio_rule' => '{NÚMERO DE CLIENTE}-REQ-{AÑO}-{0000}',
            'read_only' => true,
            'write_enabled' => false,
        ];
    }

    /** Next free internal reference SRV-{PROJECT}-{YYYY}-{NNNN} (the original's "⚙ Generar"; suggestion only). */
    public function nextInternalReference(int $org, string $project, string $date): array
    {
        $part = RequisitionRecoveryInput::cleanFolioPart($project);
        $prefix = 'SRV-' . ($part !== '' ? $part : 'PROYECTO') . '-' . substr($date, 0, 4) . '-';
        $like = $prefix . '%'; // cleanFolioPart only leaves [A-Z0-9-]: nothing to escape for LIKE.
        $rows = $this->rows(
            'SELECT internal_reference AS v FROM requisitions WHERE organization_id=? AND internal_reference LIKE ?
             UNION ALL SELECT client_reference FROM requisitions WHERE organization_id=? AND client_reference LIKE ?
             UNION ALL SELECT internal_reference FROM service_orders WHERE organization_id=? AND internal_reference LIKE ?',
            [$org, $like, $org, $like, $org, $like]
        );
        $max = 0;
        $taken = [];
        foreach ($rows as $row) {
            $v = strtoupper(trim((string) $row['v']));
            $taken[$v] = true;
            if (str_starts_with($v, $prefix)) {
                $tail = substr($v, strlen($prefix));
                if ($tail !== '' && ctype_digit($tail)) {
                    $max = max($max, (int) $tail);
                }
            }
        }
        do {
            $max++;
            $value = $prefix . str_pad((string) $max, 4, '0', STR_PAD_LEFT);
        } while (isset($taken[$value]));
        return ['reference' => $value, 'prefix' => $prefix, 'sequence' => $max, 'suggestion_only' => true];
    }

    /** Whether a client folio / internal reference is already used (requisitions and service records). */
    public function newRequestAvailability(int $org, string $folio, string $reference): array
    {
        $out = [];
        if ($folio !== '') {
            $hit = $this->rows(
                'SELECT r.folio,c.code AS client_code FROM requisitions r JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
                 WHERE r.organization_id=? AND UPPER(r.folio)=UPPER(?) LIMIT 1',
                [$org, $folio]
            );
            $out['folio'] = ['value' => $folio, 'available' => $hit === [], 'requisition' => $hit[0]['folio'] ?? null, 'client_code' => $hit[0]['client_code'] ?? null];
        }
        if ($reference !== '') {
            $hits = $this->rows(
                'SELECT folio FROM (
                   SELECT r.folio FROM requisitions r WHERE r.organization_id=? AND (r.internal_reference=? OR r.client_reference=?)
                   UNION SELECT so.folio FROM service_orders so WHERE so.organization_id=? AND so.internal_reference=?
                 ) x ORDER BY folio LIMIT 5',
                [$org, $reference, $reference, $org, $reference]
            );
            $out['reference'] = ['value' => $reference, 'available' => $hits === [], 'used_by' => array_column($hits, 'folio')];
        }
        return $out;
    }

    /**
     * Formulario "Nuevo servicio" › Contratación de proveedor: proveedores y sus OC vigentes (última versión, no
     * canceladas ni sustituidas) con importe, moneda y estatus, para vincular la OC emitida. Solo lectura.
     * @return array<string,mixed>
     */
    public function contracting(int $org): array
    {
        $suppliers = $this->rows(
            "SELECT e.public_id AS id,s.code,s.legal_name AS name,COALESCE(NULLIF(TRIM(s.legacy_status),''),s.status_code) AS status
             FROM suppliers s JOIN business_entities e ON e.id=s.id AND e.organization_id=s.organization_id
             WHERE s.organization_id=? AND e.archived_at IS NULL ORDER BY s.legal_name,s.id",
            [$org]
        );
        $orders = $this->rows(
            "SELECT pe.public_id AS id,po.folio,se.public_id AS supplier_id,po.currency_code AS currency,po.total_amount AS total,
                    COALESCE(NULLIF(TRIM(po.legacy_status),''),po.operational_status) AS status,po.order_date,
                    (SELECT COUNT(*) FROM service_orders so WHERE so.organization_id=po.organization_id AND so.supplier_purchase_order_id=po.id) AS services
             FROM purchase_orders po
             JOIN business_entities pe ON pe.id=po.id AND pe.organization_id=po.organization_id
             JOIN business_entities se ON se.id=po.supplier_id AND se.organization_id=po.organization_id
             WHERE po.organization_id=? AND pe.archived_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM purchase_orders nx WHERE nx.organization_id=po.organization_id AND nx.series_public_id=po.series_public_id AND nx.version_number>po.version_number)
               AND LOWER(COALESCE(po.legacy_status,po.operational_status,'')) NOT IN ('cancelada','sustituida','cancelled','superseded')
             ORDER BY COALESCE(po.order_date,DATE(pe.created_at)) DESC,po.id DESC",
            [$org]
        );
        foreach ($orders as &$o) {
            $o['total'] = $o['total'] === null ? null : (float) $o['total'];
            $o['services'] = (int) $o['services'];
        }
        unset($o);
        return ['suppliers' => $suppliers, 'purchase_orders' => $orders, 'read_only' => true];
    }
}
