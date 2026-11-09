<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Database\SessionContract;
use DateTimeImmutable;
use DateTimeZone;
use mysqli;
use mysqli_result;
use RuntimeException;
use Throwable;

/** Sólo borradores nuevos v0.7. Nunca actualiza requisiciones importadas. */
final class RequisitionWriteRepository
{
    private mysqli $db;
    private const SOURCE = 'supplyflow_v07_draft';

    public function __construct()
    {
        $user = (string) (getenv('REQWRITE_DB_USERNAME') ?: '');
        $path = (string) (getenv('REQWRITE_DB_PASSWORD_FILE') ?: '');
        if ($user !== 'supplyflow_reqwrite_local' || $path !== '/run/secrets/reqwrite_db_password' || ! is_readable($path)) {
            throw new RuntimeException('REQUISITION_WRITE_UNAVAILABLE');
        }
        $password = trim((string) file_get_contents($path));
        if (! preg_match('/^[0-9a-f]{64}$/D', $password)) {
            throw new RuntimeException('REQUISITION_WRITE_UNAVAILABLE');
        }
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        try {
            $this->db = new mysqli('db', $user, $password, 'supplyflow_dev', 3306);
            SessionContract::initialize($this->db, 'supplyflow_dev');
        } catch (Throwable $error) {
            throw new RuntimeException('REQUISITION_WRITE_UNAVAILABLE', 0, $error);
        } finally {
            unset($password);
        }
    }

    public function __destruct()
    {
        if (isset($this->db)) {
            $this->db->close();
        }
    }

    private function queryOne(string $sql, string $types = '', array $args = []): ?array
    {
        $stmt = $this->db->prepare($sql);
        try {
            if ($types !== '') {
                $stmt->bind_param($types, ...$args);
            }
            $stmt->execute();
            $result = $stmt->get_result();
            if (! $result instanceof mysqli_result) {
                throw new RuntimeException('REQUISITION_QUERY_FAILED');
            }
            return $result->fetch_assoc() ?: null;
        } finally {
            $stmt->close();
        }
    }

    private function queryRows(string $sql, string $types = '', array $args = []): array
    {
        $stmt = $this->db->prepare($sql);
        try {
            if ($types !== '') {
                $stmt->bind_param($types, ...$args);
            }
            $stmt->execute();
            $result = $stmt->get_result();
            if (! $result instanceof mysqli_result) {
                throw new RuntimeException('REQUISITION_QUERY_FAILED');
            }
            return $result->fetch_all(MYSQLI_ASSOC);
        } finally {
            $stmt->close();
        }
    }

    private function command(string $sql, string $types = '', array $args = []): int
    {
        $stmt = $this->db->prepare($sql);
        try {
            if ($types !== '') {
                $stmt->bind_param($types, ...$args);
            }
            $stmt->execute();
            return (int) $stmt->affected_rows;
        } finally {
            $stmt->close();
        }
    }

    private static function uuid(): string
    {
        $v = bin2hex(random_bytes(16));
        $v[12] = '4';
        $v[16] = dechex((hexdec($v[16]) & 3) | 8);
        return substr($v, 0, 8) . '-' . substr($v, 8, 4) . '-' . substr($v, 12, 4) . '-' . substr($v, 16, 4) . '-' . substr($v, 20);
    }

    private function idempotency(int $org, int $actor, string $endpoint, string $key, string $requestHash): ?array
    {
        $digest = hash('sha256', $key, true);
        $affected = $this->command(<<<'SQL'
            INSERT IGNORE INTO idempotency_keys
                (organization_id,actor_user_id,endpoint_code,key_sha256,request_sha256,state_code,created_at,expires_at)
            VALUES (?,?,?,?,?,'processing',UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 30 DAY))
            SQL, 'iisss', [$org, $actor, $endpoint, $digest, $requestHash]);
        if ($affected === 1) {
            return null;
        }
        $existing = $this->queryOne('SELECT request_sha256,state_code,response_json,response_status FROM idempotency_keys WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? FOR UPDATE', 'iiss', [$org, $actor, $endpoint, $digest]);
        if (! $existing || ! hash_equals((string) $existing['request_sha256'], $requestHash)) {
            throw new RequisitionConflict('IDEMPOTENCY_CONFLICT', 'La clave de solicitud ya se usó para otro contenido.');
        }
        if ($existing['state_code'] !== 'done') {
            throw new RequisitionConflict('IDEMPOTENCY_PENDING', 'La operación sigue en proceso.');
        }
        $saved = json_decode((string) $existing['response_json'], true);
        if (! is_array($saved) || ! isset($saved['id'])) {
            throw new RuntimeException('REPLAY_UNAVAILABLE');
        }
        $saved['replayed'] = true;
        return $saved;
    }

    private function finalizeIdempotency(int $org, int $actor, string $endpoint, string $key, array $response): void
    {
        $this->command("UPDATE idempotency_keys SET state_code='done',response_status=200,response_json=? WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? AND state_code='processing'", 'siiss', [json_encode($response, JSON_THROW_ON_ERROR), $org, $actor, $endpoint, hash('sha256', $key, true)]);
    }

    private function client(int $org, string $id): array
    {
        $row = $this->queryOne(<<<'SQL'
            SELECT c.id,c.code,c.legal_name,c.default_project_reference,c.default_contract_reference
            FROM clients c JOIN business_entities e ON e.id=c.id AND e.organization_id=c.organization_id
            WHERE c.organization_id=? AND e.public_id=? AND e.entity_kind='client' AND e.archived_at IS NULL AND c.status_code='active' LIMIT 1
            SQL, 'is', [$org, $id]);
        if (! $row) {
            throw new RequisitionConflict('CLIENT_UNAVAILABLE', 'El cliente no existe o no está activo.');
        }
        return $row;
    }

    private function currency(string $code): void
    {
        if (! $this->queryOne('SELECT code FROM currencies WHERE code=? AND active=1', 's', [$code])) {
            throw new RequisitionConflict('CURRENCY_UNAVAILABLE', 'La moneda no está disponible.');
        }
    }

    private function folio(int $org): string
    {
        $year = (new DateTimeImmutable('now', new DateTimeZone('America/Monterrey')))->format('Y');
        $this->command(<<<'SQL'
            INSERT INTO document_sequences (organization_id,document_kind,series_code,period_key,next_value,updated_at)
            VALUES (?,'requisition','SF-REQ',?,1,UTC_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE next_value=next_value
            SQL, 'is', [$org, $year]);
        $row = $this->queryOne("SELECT next_value FROM document_sequences WHERE organization_id=? AND document_kind='requisition' AND series_code='SF-REQ' AND period_key=? FOR UPDATE", 'is', [$org, $year]);
        $number = (int) ($row['next_value'] ?? 0);
        if ($number <= 0 || $number > 999999) {
            throw new RuntimeException('REQUISITION_SEQUENCE_EXHAUSTED');
        }
        $this->command("UPDATE document_sequences SET next_value=next_value+1,updated_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND document_kind='requisition' AND series_code='SF-REQ' AND period_key=?", 'is', [$org, $year]);
        return sprintf('SF-REQ-%s-%06d', $year, $number);
    }

    private function insertItem(int $org, int $reqId, int $index, array $line): void
    {
        $this->command(<<<'SQL'
            INSERT INTO requisition_items (organization_id,requisition_id,public_id,line_number,display_order,description,quantity,unit_label,category_label_snapshot,line_status)
            VALUES (?,?,?,?,?,?,?,?,?,'active')
            SQL, 'iisiissss', [$org, $reqId, self::uuid(), $index, $index, $line['description'], $line['quantity'], $line['unit'], $line['category']]);
    }

    private function audit(int $org, int $actor, int $entityId, string $action, array $detail): void
    {
        $this->command(<<<'SQL'
            INSERT INTO audit_events (organization_id,public_id,subject_entity_id,actor_user_id,module_code,action_code,result_code,occurred_at,recorded_at,changes_json,source_kind)
            VALUES (?,?,?,?,'requisitions',?,'success',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),?,'system')
            SQL, 'isiiss', [$org, self::uuid(), $entityId, $actor, $action, json_encode($detail, JSON_THROW_ON_ERROR)]);
        $this->command(<<<'SQL'
            INSERT INTO workflow_events (organization_id,entity_id,public_id,workflow_code,action_code,from_state,to_state,actor_user_id,occurred_at,recorded_at,provenance)
            VALUES (?,?,?,'requisition',?,'draft','draft',?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),'system')
            SQL, 'iissi', [$org, $entityId, self::uuid(), $action, $actor]);
    }

    private function snapshot(int $org, int $reqId, int $revision, array $input, string $action): void
    {
        $json = json_encode(['schema_version' => 1, 'source' => self::SOURCE, 'draft_revision' => $revision, 'data' => $input], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        $this->command(<<<'SQL'
            INSERT INTO requisition_revision_snapshots (organization_id,requisition_id,revision_number,snapshot_schema_version,snapshot_json,snapshot_sha256,reason_text,recorded_at,provenance)
            VALUES (?,?,?,1,?,?,?,UTC_TIMESTAMP(6),'system')
            SQL, 'iiisss', [$org, $reqId, $revision, $json, hash('sha256', $json, true), $action]);
    }

    private function updateHeader(int $org, int $reqId, array $input, array $client, int $revision): void
    {
        $snapshot = json_encode(['code' => $client['code'], 'legal_name' => $client['legal_name']], JSON_THROW_ON_ERROR);
        $this->command(<<<'SQL'
            UPDATE requisitions SET client_id=?,client_reference=?,request_date=?,need_date=?,priority_code=?,
              client_snapshot=?,project_reference_snapshot=?,contract_reference_snapshot=?,requester_name=?,requester_email=?,
              delivery_place=?,budget_amount=?,currency_code=?,description=?,notes=?,current_revision_number=?
            WHERE id=? AND organization_id=? AND request_source_type='supplyflow_v07_draft'
            SQL, 'issssssssssssssiii', [
                (int)$client['id'],$input['client_reference'],$input['request_date'],$input['need_date'],$input['priority'],
                $snapshot,$input['project'],$input['contract'],$input['requester_name'],$input['requester_email'],
                $input['delivery_place'],$input['budget'],$input['currency'],$input['description'],$input['notes'],
                $revision,$reqId,$org,
            ]);
    }

    /** @return array<string,mixed> */
    public function create(int $org, int $actor, array $input, string $key): array
    {
        $hash = hash('sha256', json_encode($input, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), true);
        $this->db->begin_transaction();
        try {
            $endpoint = 'requisition.draft.create.v07';
            if ($again = $this->idempotency($org, $actor, $endpoint, $key, $hash)) {
                $this->db->commit();
                return $again;
            }
            $client = $this->client($org, $input['client_id']);
            $this->currency($input['currency']);
            $folio = $this->folio($org);
            $public = self::uuid();
            $this->command("INSERT INTO business_entities (organization_id,public_id,entity_kind,created_at,updated_at,created_by,updated_by,row_version) VALUES (?,?,'requisition',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),?,?,1)", 'isii', [$org,$public,$actor,$actor]);
            $id = (int) $this->db->insert_id;
            $this->command(<<<'SQL'
                INSERT INTO requisitions (id,organization_id,client_id,folio,request_date,need_date,priority_code,route_code,
                  request_source_type,currency_code,current_revision_number)
                VALUES (?,?,?,?,?,?,?,'supply','supplyflow_v07_draft',?,0)
                SQL, 'iiisssss', [$id,$org,(int)$client['id'],$folio,$input['request_date'],$input['need_date'],$input['priority'],$input['currency']]);
            $this->updateHeader($org, $id, $input, $client, 0);
            foreach ($input['items'] as $index => $line) {
                $this->insertItem($org, $id, $index + 1, $line);
            }
            $this->snapshot($org, $id, 0, $input, 'Borrador nuevo');
            $this->audit($org, $actor, $id, 'requisition.draft.create', ['folio'=>$folio,'lines'=>count($input['items'])]);
            $out = ['id'=>$public,'folio'=>$folio,'version'=>1,'draft'=>true,'line_count'=>count($input['items']),'replayed'=>false];
            $this->finalizeIdempotency($org, $actor, $endpoint, $key, $out);
            $this->db->commit();
            return $out;
        } catch (Throwable $error) {
            $this->db->rollback();
            throw $error;
        }
    }

    public function update(int $org, int $actor, string $id, int $version, array $input, string $key): array
    {
        $hash = hash('sha256', json_encode(['version'=>$version,'data'=>$input], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), true);
        $endpoint = 'requisition.draft.update.v07.' . $id;
        $this->db->begin_transaction();
        try {
            if ($again = $this->idempotency($org, $actor, $endpoint, $key, $hash)) {
                $this->db->commit();
                return $again;
            }
            $current = $this->queryOne(<<<'SQL'
                SELECT e.id,e.row_version,r.folio FROM business_entities e
                JOIN requisitions r ON r.id=e.id AND r.organization_id=e.organization_id
                WHERE e.organization_id=? AND e.public_id=? AND e.entity_kind='requisition'
                  AND e.created_by=? AND e.archived_at IS NULL AND r.request_source_type='supplyflow_v07_draft' FOR UPDATE
                SQL, 'isi', [$org,$id,$actor]);
            if (! $current) {
                throw new RequisitionConflict('DRAFT_NOT_FOUND', 'Borrador no encontrado o no editable.');
            }
            if ((int) $current['row_version'] !== $version) {
                throw new RequisitionStale('El borrador cambió desde que se abrió.');
            }
            $reqId = (int) $current['id'];
            foreach (['rfqs','supplier_quotes','customer_quote_versions','purchase_order_requisitions','requisition_reviews','requisition_change_requests'] as $table) {
                $linked = $this->queryOne("SELECT 1 AS linked FROM {$table} WHERE organization_id=? AND requisition_id=? LIMIT 1", 'ii', [$org,$reqId]);
                if ($linked) {
                    throw new RequisitionConflict('DRAFT_HAS_DEPENDENCIES','No puede editarse un documento con operaciones vinculadas.');
                }
            }
            $client = $this->client($org, $input['client_id']);
            $this->currency($input['currency']);
            $revision = $version;
            $this->updateHeader($org, $reqId, $input, $client, $revision);
            $existing = $this->queryRows('SELECT id,public_id FROM requisition_items WHERE organization_id=? AND requisition_id=? ORDER BY id FOR UPDATE', 'ii', [$org,$reqId]);
            $byPublic = [];
            foreach ($existing as $line) {
                $byPublic[$line['public_id']] = (int) $line['id'];
            }
            $used = [];
            foreach ($input['items'] as $index => $line) {
                $position = $index + 1;
                if ($line['id'] !== null) {
                    if (! isset($byPublic[$line['id']])) {
                        throw new RequisitionConflict('DRAFT_LINE_MISMATCH', 'Una partida no pertenece a este borrador.');
                    }
                    $used[$line['id']] = true;
                    $this->command(<<<'SQL'
                        UPDATE requisition_items SET line_number=?,display_order=?,description=?,quantity=?,unit_label=?,category_label_snapshot=?
                        WHERE id=? AND organization_id=? AND requisition_id=?
                        SQL, 'iissssiii', [1000 + $position,$position,$line['description'],$line['quantity'],$line['unit'],$line['category'],$byPublic[$line['id']],$org,$reqId]);
                } else {
                    $this->insertItem($org, $reqId, 1000 + $position, $line);
                }
            }
            foreach ($byPublic as $pub => $lineId) {
                if (! isset($used[$pub])) {
                    $this->command('DELETE FROM requisition_items WHERE id=? AND organization_id=? AND requisition_id=?', 'iii', [$lineId,$org,$reqId]);
                }
            }
            $this->command('UPDATE requisition_items SET display_order=line_number-1000,line_number=line_number-1000 WHERE organization_id=? AND requisition_id=? AND line_number > 1000', 'ii', [$org,$reqId]);
            $this->command('UPDATE business_entities SET row_version=row_version+1,updated_by=?,updated_at=UTC_TIMESTAMP(6) WHERE id=? AND organization_id=? AND row_version=?', 'iiii', [$actor,$reqId,$org,$version]);
            $this->snapshot($org, $reqId, $revision, $input, 'Edición de borrador');
            $this->audit($org, $actor, $reqId, 'requisition.draft.update', ['folio'=>$current['folio'],'version'=>$version+1,'lines'=>count($input['items'])]);
            $out = ['id'=>$id,'folio'=>$current['folio'],'version'=>$version+1,'draft'=>true,'line_count'=>count($input['items']),'replayed'=>false];
            $this->finalizeIdempotency($org, $actor, $endpoint, $key, $out);
            $this->db->commit();
            return $out;
        } catch (Throwable $error) {
            $this->db->rollback();
            throw $error;
        }
    }

    public function drafts(int $org, int $actor): array
    {
        $rows = $this->queryRows(<<<'SQL'
            SELECT e.public_id AS id,e.row_version AS version,r.folio,r.request_date,c.legal_name AS client,r.description,
                (SELECT COUNT(*) FROM requisition_items li WHERE li.organization_id=r.organization_id AND li.requisition_id=r.id) AS line_count
            FROM requisitions r JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id
            JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            WHERE r.organization_id=? AND e.created_by=? AND r.request_source_type='supplyflow_v07_draft' AND e.archived_at IS NULL
            ORDER BY e.id DESC LIMIT 100
            SQL, 'ii', [$org,$actor]);
        foreach ($rows as &$row) {
            $row['version'] = (int) $row['version'];
            $row['line_count'] = (int) $row['line_count'];
        }
        unset($row);
        return ['items'=>$rows,'limit'=>100];
    }

    public function draft(int $org, int $actor, string $id): ?array
    {
        $row = $this->queryOne(<<<'SQL'
            SELECT e.public_id AS id,e.row_version AS version,r.id AS db_id,r.folio,ce.public_id AS client_id,
                r.request_date,r.need_date,r.priority_code AS priority,r.currency_code AS currency,
                r.client_reference,r.project_reference_snapshot AS project,r.contract_reference_snapshot AS contract,
                r.requester_name,r.requester_email,r.delivery_place,r.budget_amount AS budget,r.description,r.notes
            FROM requisitions r JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id
            JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
            JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id
            WHERE r.organization_id=? AND e.public_id=? AND e.created_by=? AND r.request_source_type='supplyflow_v07_draft' AND e.archived_at IS NULL
            SQL, 'isi', [$org,$id,$actor]);
        if (! $row) {
            return null;
        }
        $reqId = (int) $row['db_id'];
        unset($row['db_id']);
        $row['version'] = (int) $row['version'];
        $row['items'] = $this->queryRows(<<<'SQL'
            SELECT public_id AS id,description,quantity,unit_label AS unit,category_label_snapshot AS category
            FROM requisition_items WHERE organization_id=? AND requisition_id=? ORDER BY line_number,id
            SQL, 'ii', [$org,$reqId]);
        return $row;
    }
}

final class RequisitionConflict extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }
}

final class RequisitionStale extends RuntimeException {}
