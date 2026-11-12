<?php

declare(strict_types=1);

namespace App\Libraries;

use Throwable;

/**
 * Catálogo de proveedores · alta y actualización (ver CatalogWriteBase): número único, categoría (se vincula a una categoría
 * activa con el mismo nombre; si no existe se conserva como texto), estatus/crédito/unidad del catálogo o el valor ya
 * guardado, calificación en la escala del registro (importados 1–5; nuevos 0–100), contactos, correos, teléfonos y logotipo.
 * Al cambiar el estatus se limpia el estatus textual histórico (la bitácora conserva el anterior).
 */
final class SupplierWriteRepository extends CatalogWriteBase
{
    protected const LOGO_ROLE = 'supplierLogo';
    protected const LOGO_KEY = 'supplier-logo-';
    private const NEW_SCALE = '100';

    private function assertCodeFree(int $org, string $code, ?int $except): void
    {
        $row = $this->one('SELECT id FROM suppliers WHERE organization_id=? AND code=? FOR UPDATE', 'is', [$org, $code]);
        if ($row && (int) $row['id'] !== $except) {
            throw new CatalogConflict('CODE_TAKEN', 'Ese número de proveedor ya está registrado.');
        }
    }

    /** Catalog value, empty (null) or the value already stored (kept unchanged). */
    private static function choice(string $value, array $allowed, ?string $current, string $label): ?string
    {
        if ($value === '') {
            return null;
        }
        if (in_array($value, $allowed, true) || ($current !== null && $value === $current)) {
            return $value;
        }
        throw new CatalogConflict('INVALID_VALUE', 'El valor de ' . $label . ' no es válido.');
    }

    private function snapshot(int $org, int $id): array
    {
        $s = $this->one('SELECT s.code,s.supplier_key,s.legal_name,s.tax_identifier,s.category_id,COALESCE(c.name,s.legacy_category_label) AS category,s.legacy_category_label,s.status_code,s.legacy_status,s.default_currency,s.credit_type,s.credit_days,s.lead_time_value,s.lead_time_unit,s.rating,s.rating_scale,s.document_notes,s.notes,s.data_incomplete FROM suppliers s LEFT JOIN categories c ON c.id=s.category_id AND c.organization_id=s.organization_id WHERE s.organization_id=? AND s.id=?', 'ii', [$org, $id]) ?? [];
        $s['contacts'] = array_column($this->rows('SELECT display_name FROM party_contacts WHERE organization_id=? AND owner_entity_id=? AND active=1 ORDER BY is_primary DESC,source_ordinal,id', 'ii', [$org, $id]), 'display_name');
        $s['emails'] = array_column($this->rows("SELECT value FROM party_contact_channels WHERE organization_id=? AND owner_entity_id=? AND channel_type='email' ORDER BY is_primary DESC,source_ordinal,id", 'ii', [$org, $id]), 'value');
        $s['phones'] = array_column($this->rows("SELECT value FROM party_contact_channels WHERE organization_id=? AND owner_entity_id=? AND channel_type='phone' ORDER BY is_primary DESC,source_ordinal,id", 'ii', [$org, $id]), 'value');
        $s['logo_file'] = $this->logoFile($org, $id);
        return $s;
    }

    /** @return array<string,mixed> resolved column values */
    private function resolve(int $org, array $p, ?array $before): array
    {
        $cat = $this->one('SELECT id FROM categories WHERE organization_id=? AND name=? AND active=1 ORDER BY id LIMIT 1', 'is', [$org, $p['category']]);
        $status = self::choice($p['status'], SupplierInput::STATUSES, $before['status_code'] ?? null, 'estatus');
        if ($status === null) {
            throw new CatalogConflict('INVALID_VALUE', 'El estatus es obligatorio.');
        }
        $scale = $before['rating_scale'] ?? null;
        $scale = $scale !== null && is_numeric($scale) && (float) $scale > 0 ? (string) $scale : self::NEW_SCALE;
        if ($p['rating'] !== null && (float) $p['rating'] > (float) $scale) {
            throw new CatalogConflict('INVALID_VALUE', 'La calificación excede la escala del proveedor (0–' . $scale . ').');
        }
        return [
            'category_id' => $cat ? (int) $cat['id'] : null,
            'category_label' => $cat ? null : $p['category'],
            'status' => $status,
            'legacy_status' => $before !== null && $status === ($before['status_code'] ?? null) ? ($before['legacy_status'] ?? null) : null,
            'currency' => $p['currency'] !== '' ? $p['currency'] : null,
            'credit_type' => self::choice($p['credit_type'], SupplierInput::CREDIT_TYPES, $before['credit_type'] ?? null, 'tipo de crédito'),
            'lead_unit' => self::choice($p['lead_time_unit'], SupplierInput::LEAD_UNITS, $before['lead_time_unit'] ?? null, 'unidad del tiempo de entrega'),
            'rating_scale' => $p['rating'] !== null ? $scale : ($before['rating_scale'] ?? null),
        ];
    }

    private function writeSupplier(int $org, int $id, array $p, array $r, bool $insert): void
    {
        $args = [$p['code'], $p['supplier_key'] ?: null, $p['name'], $p['tax_id'] ?: null, $r['category_id'], $r['category_label'], $r['status'], $r['legacy_status'],
            $r['currency'], $r['credit_type'], $p['credit_days'], $p['lead_time_value'], $r['lead_unit'], $p['rating'], $r['rating_scale'], $p['document_notes'] ?: null, $p['notes'] ?: null];
        $types = 'ssssisssssisssss' . 's';
        if ($insert) {
            $this->exec('INSERT INTO suppliers (code,supplier_key,legal_name,tax_identifier,category_id,legacy_category_label,status_code,legacy_status,default_currency,credit_type,credit_days,lead_time_value,lead_time_unit,rating,rating_scale,document_notes,notes,data_incomplete,provisional_code,provisional_name,id,organization_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,?,?)',
                $types . 'ii', [...$args, $id, $org]);
            return;
        }
        $this->exec('UPDATE suppliers SET code=?,supplier_key=?,legal_name=?,tax_identifier=?,category_id=?,legacy_category_label=?,status_code=?,legacy_status=?,default_currency=?,credit_type=?,credit_days=?,lead_time_value=?,lead_time_unit=?,rating=?,rating_scale=?,document_notes=?,notes=?,data_incomplete=0,provisional_code=0,provisional_name=0 WHERE organization_id=? AND id=?',
            $types . 'ii', [...$args, $org, $id]);
    }

    /** @return array{id:string,version:int,code:string,replayed:bool} */
    public function create(int $org, int $actor, array $p, string $key): array
    {
        $endpoint = 'catalog.suppliers.create';
        $this->db->begin_transaction();
        try {
            if ($replay = $this->idempotency($org, $actor, $endpoint, $key, self::fingerprint($p))) {
                $this->db->commit();
                return $replay;
            }
            $this->assertCodeFree($org, $p['code'], null);
            $resolved = $this->resolve($org, $p, null);
            $public = self::uuid();
            $this->exec("INSERT INTO business_entities (organization_id,public_id,entity_kind,created_at,updated_at,created_by,updated_by,row_version) VALUES (?,?,'supplier',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),?,?,1)", 'isii', [$org, $public, $actor, $actor]);
            $id = (int) $this->db->insert_id;
            $this->writeSupplier($org, $id, $p, $resolved, true);
            $this->syncContacts($org, $id, $p['contacts']);
            $this->syncChannels($org, $id, 'email', $p['emails']);
            $this->syncChannels($org, $id, 'phone', $p['phones']);
            $this->saveLogo($org, $id, $actor, $p['logo']);
            $this->audit($org, $id, $actor, 'supplier.create', ['after' => $this->snapshot($org, $id)]);
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
        $endpoint = 'catalog.suppliers.update:' . $publicId;
        $this->db->begin_transaction();
        try {
            if ($replay = $this->idempotency($org, $actor, $endpoint, $key, self::fingerprint($p + ['_version' => $version]))) {
                $this->db->commit();
                return $replay;
            }
            $row = $this->one("SELECT e.id,e.row_version FROM business_entities e JOIN suppliers s ON s.id=e.id AND s.organization_id=e.organization_id WHERE e.organization_id=? AND e.public_id=? AND e.entity_kind='supplier' AND e.archived_at IS NULL FOR UPDATE", 'is', [$org, $publicId]);
            if (! $row) {
                throw new CatalogConflict('NOT_FOUND', 'Proveedor no encontrado.');
            }
            $id = (int) $row['id'];
            if ((int) $row['row_version'] !== $version) {
                throw new CatalogStale('El proveedor cambió desde que se abrió. Recarga la ficha antes de guardar.');
            }
            $before = $this->snapshot($org, $id);
            $this->assertCodeFree($org, $p['code'], $id);
            $this->writeSupplier($org, $id, $p, $this->resolve($org, $p, $before), false);
            $this->syncContacts($org, $id, $p['contacts']);
            $this->syncChannels($org, $id, 'email', $p['emails']);
            $this->syncChannels($org, $id, 'phone', $p['phones']);
            $this->saveLogo($org, $id, $actor, $p['logo']);
            $this->exec('UPDATE business_entities SET row_version=row_version+1,updated_by=?,updated_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND id=? AND row_version=?', 'iiii', [$actor, $org, $id, $version]);
            $changes = self::diff($before, $this->snapshot($org, $id));
            $this->audit($org, $id, $actor, 'supplier.update', ['version' => $version + 1, 'changes' => $changes]);
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
