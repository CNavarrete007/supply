<?php

declare(strict_types=1);

namespace App\Libraries;

use Throwable;

/**
 * Catálogo de clientes · alta y actualización (ver CatalogWriteBase): número único, política de recompra (catálogo o el
 * valor histórico ya guardado), contactos, correos, teléfonos y logotipo. No administra el portal del cliente ni sus claves.
 */
final class ClientWriteRepository extends CatalogWriteBase
{
    protected const LOGO_ROLE = 'clientLogo';
    protected const LOGO_KEY = 'client-logo-';

    private function assertCodeFree(int $org, string $code, ?int $except): void
    {
        $row = $this->one('SELECT id FROM clients WHERE organization_id=? AND code=? FOR UPDATE', 'is', [$org, $code]);
        if ($row && (int) $row['id'] !== $except) {
            throw new CatalogConflict('CODE_TAKEN', 'Ese número de cliente ya está registrado.');
        }
    }

    /** Policy codes: catalog values, empty, or the legacy value already stored (unchanged). */
    private static function policyValue(string $value, array $allowed, ?string $current, string $field): ?string
    {
        if ($value === '') {
            return null;
        }
        if (in_array($value, $allowed, true) || ($current !== null && $value === $current)) {
            return $value;
        }
        throw new CatalogConflict('INVALID_POLICY', 'La política seleccionada no es válida (' . $field . ').');
    }

    private function snapshot(int $org, int $id): array
    {
        $c = $this->one('SELECT code,legal_name,brand_name,tax_identifier,default_project_reference,default_contract_reference,address_text,commercial_terms,notes,status_code,repeat_sales_policy,repeat_sourcing_policy,repeat_price_validity_days,repeat_contract_reference,repeat_contract_valid_until,repeat_min_margin_pct,data_incomplete,provisional_code,provisional_name FROM clients WHERE organization_id=? AND id=?', 'ii', [$org, $id]) ?? [];
        $c['contacts'] = array_column($this->rows('SELECT display_name FROM party_contacts WHERE organization_id=? AND owner_entity_id=? AND active=1 ORDER BY is_primary DESC,source_ordinal,id', 'ii', [$org, $id]), 'display_name');
        $c['emails'] = array_column($this->rows("SELECT value FROM party_contact_channels WHERE organization_id=? AND owner_entity_id=? AND channel_type='email' ORDER BY is_primary DESC,source_ordinal,id", 'ii', [$org, $id]), 'value');
        $c['phones'] = array_column($this->rows("SELECT value FROM party_contact_channels WHERE organization_id=? AND owner_entity_id=? AND channel_type='phone' ORDER BY is_primary DESC,source_ordinal,id", 'ii', [$org, $id]), 'value');
        $c['logo_file'] = $this->logoFile($org, $id);
        return $c;
    }

    private function writeClient(int $org, int $id, array $p, array $policy, bool $insert): void
    {
        $args = [$p['code'], $p['name'], $p['brand_name'] ?: null, $p['tax_id'] ?: null, $p['address'] ?: null, $p['terms'] ?: null, $p['project'], $p['contract_reference'], $p['notes'] ?: null, $p['status'],
            $policy['sales'], $policy['sourcing'], $policy['days'], $policy['ref'], $policy['until'], $policy['margin']];
        if ($insert) {
            $this->exec('INSERT INTO clients (code,legal_name,brand_name,tax_identifier,address_text,commercial_terms,default_project_reference,default_contract_reference,notes,status_code,repeat_sales_policy,repeat_sourcing_policy,repeat_price_validity_days,repeat_contract_reference,repeat_contract_valid_until,repeat_min_margin_pct,repeat_policy_updated_at,data_incomplete,provisional_code,provisional_name,portal_enabled,portal_locked,id,organization_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?,UTC_TIMESTAMP(6),NULL),0,0,0,0,1,?,?)',
                'ssssssssssssisssiii', [...$args, $policy['changed'] ? 1 : 0, $id, $org]);
            return;
        }
        $this->exec('UPDATE clients SET code=?,legal_name=?,brand_name=?,tax_identifier=?,address_text=?,commercial_terms=?,default_project_reference=?,default_contract_reference=?,notes=?,status_code=?,repeat_sales_policy=?,repeat_sourcing_policy=?,repeat_price_validity_days=?,repeat_contract_reference=?,repeat_contract_valid_until=?,repeat_min_margin_pct=?,repeat_policy_updated_at=IF(?,UTC_TIMESTAMP(6),repeat_policy_updated_at),data_incomplete=0,provisional_code=0,provisional_name=0 WHERE organization_id=? AND id=?',
            'ssssssssssssisssiii', [...$args, $policy['changed'] ? 1 : 0, $org, $id]);
    }

    private function policy(array $p, ?array $before): array
    {
        $r = $p['repeat_policy'];
        $policy = [
            'sales' => self::policyValue($r['sales_policy'], ClientInput::SALES_POLICIES, $before['repeat_sales_policy'] ?? null, 'precio al cliente'),
            'sourcing' => self::policyValue($r['sourcing_policy'], ClientInput::SOURCING_POLICIES, $before['repeat_sourcing_policy'] ?? null, 'abastecimiento'),
            'days' => $r['price_validity_days'], 'ref' => $r['contract_reference'] !== '' ? $r['contract_reference'] : null,
            'until' => $r['contract_valid_until'], 'margin' => $r['min_margin_pct'],
        ];
        $prev = [$before['repeat_sales_policy'] ?? null, $before['repeat_sourcing_policy'] ?? null, isset($before['repeat_price_validity_days']) ? (int) $before['repeat_price_validity_days'] : null,
            $before['repeat_contract_reference'] ?? null, $before['repeat_contract_valid_until'] ?? null, isset($before['repeat_min_margin_pct']) ? number_format((float) $before['repeat_min_margin_pct'], 4, '.', '') : null];
        $policy['changed'] = $prev !== [$policy['sales'], $policy['sourcing'], $policy['days'], $policy['ref'], $policy['until'], $policy['margin']];
        return $policy;
    }

    /** @return array{id:string,version:int,code:string,replayed:bool} */
    public function create(int $org, int $actor, array $p, string $key): array
    {
        $endpoint = 'catalog.clients.create';
        $this->db->begin_transaction();
        try {
            if ($replay = $this->idempotency($org, $actor, $endpoint, $key, self::fingerprint($p))) {
                $this->db->commit();
                return $replay;
            }
            $this->assertCodeFree($org, $p['code'], null);
            $public = self::uuid();
            $this->exec("INSERT INTO business_entities (organization_id,public_id,entity_kind,created_at,updated_at,created_by,updated_by,row_version) VALUES (?,?,'client',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),?,?,1)", 'isii', [$org, $public, $actor, $actor]);
            $id = (int) $this->db->insert_id;
            $this->writeClient($org, $id, $p, $this->policy($p, null), true);
            $this->syncContacts($org, $id, $p['contacts']);
            $this->syncChannels($org, $id, 'email', $p['emails']);
            $this->syncChannels($org, $id, 'phone', $p['phones']);
            $this->saveLogo($org, $id, $actor, $p['logo']);
            $after = $this->snapshot($org, $id);
            $this->audit($org, $id, $actor, 'client.create', ['after' => $after]);
            $response = ['id' => $public, 'version' => 1, 'code' => $p['code'], 'replayed' => false];
            $this->finish($org, $actor, $endpoint, $key, $response);
            $this->db->commit();
            return $response;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    /** @return array{id:string,version:int,code:string,replayed:bool,changed:list<string>} */
    public function update(int $org, int $actor, string $publicId, int $version, array $p, string $key): array
    {
        $endpoint = 'catalog.clients.update:' . $publicId;
        $this->db->begin_transaction();
        try {
            if ($replay = $this->idempotency($org, $actor, $endpoint, $key, self::fingerprint($p + ['_version' => $version]))) {
                $this->db->commit();
                return $replay;
            }
            $row = $this->one("SELECT e.id,e.row_version FROM business_entities e JOIN clients c ON c.id=e.id AND c.organization_id=e.organization_id WHERE e.organization_id=? AND e.public_id=? AND e.entity_kind='client' AND e.archived_at IS NULL FOR UPDATE", 'is', [$org, $publicId]);
            if (! $row) {
                throw new CatalogConflict('NOT_FOUND', 'Cliente no encontrado.');
            }
            $id = (int) $row['id'];
            if ((int) $row['row_version'] !== $version) {
                throw new CatalogStale('El cliente cambió desde que se abrió. Recarga la ficha antes de guardar.');
            }
            $before = $this->snapshot($org, $id);
            $this->assertCodeFree($org, $p['code'], $id);
            $this->writeClient($org, $id, $p, $this->policy($p, $before), false);
            $this->syncContacts($org, $id, $p['contacts']);
            $this->syncChannels($org, $id, 'email', $p['emails']);
            $this->syncChannels($org, $id, 'phone', $p['phones']);
            $this->saveLogo($org, $id, $actor, $p['logo']);
            $this->exec('UPDATE business_entities SET row_version=row_version+1,updated_by=?,updated_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND id=? AND row_version=?', 'iiii', [$actor, $org, $id, $version]);
            $after = $this->snapshot($org, $id);
            $changes = self::diff($before, $after);
            $this->audit($org, $id, $actor, 'client.update', ['version' => $version + 1, 'changes' => $changes]);
            $response = ['id' => $publicId, 'version' => $version + 1, 'code' => $p['code'], 'replayed' => false, 'changed' => array_keys($changes)];
            $this->finish($org, $actor, $endpoint, $key, $response);
            $this->db->commit();
            return $response;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }
}
