<?php

declare(strict_types=1);

namespace App\Libraries;

use Throwable;

/**
 * Suministros de proveedores · alta y actualización (ver CatalogWriteBase). La tabla no tiene row_version: la versión es
 * updated_at en microsegundos desde 2000-01-01 (TIMESTAMPDIFF, independiente de la zona horaria; 1 si nunca se actualizó)
 * y cada escritura la incrementa. Un mismo proveedor no puede repetir el nombre del suministro. La bitácora usa como
 * sujeto al proveedor dueño e incluye el identificador del suministro. Sin precios.
 */
final class OfferingWriteRepository extends CatalogWriteBase
{
    private const VERSION = "COALESCE(TIMESTAMPDIFF(MICROSECOND,'2000-01-01 00:00:00',o.updated_at),1)";

    private function supplier(int $org, string $publicId): array
    {
        $s = $this->one("SELECT s.id FROM suppliers s JOIN business_entities e ON e.id=s.id AND e.organization_id=s.organization_id WHERE s.organization_id=? AND e.public_id=? AND e.entity_kind='supplier' AND e.archived_at IS NULL", 'is', [$org, $publicId]);
        if (! $s) {
            throw new CatalogConflict('INVALID_VALUE', 'El proveedor seleccionado no existe.');
        }
        return $s;
    }

    private function assertNameFree(int $org, int $supplierId, string $name, ?int $except): void
    {
        $row = $this->one('SELECT id FROM supplier_offerings WHERE organization_id=? AND supplier_id=? AND name=? FOR UPDATE', 'iis', [$org, $supplierId, $name]);
        if ($row && (int) $row['id'] !== $except) {
            throw new CatalogConflict('DUPLICATE_OFFERING', 'Este proveedor ya tiene registrado ese producto, servicio o suministro.');
        }
    }

    private static function choice(string $value, array $allowed, ?string $current, string $label, bool $free = false): ?string
    {
        if ($value === '') {
            return null;
        }
        if ($free || in_array($value, $allowed, true) || ($current !== null && $value === $current)) {
            return $value;
        }
        throw new CatalogConflict('INVALID_VALUE', 'El valor de ' . $label . ' no es válido.');
    }

    private function snapshot(int $org, int $id): array
    {
        return $this->one('SELECT o.public_id,o.supplier_id,o.name,o.offering_type,o.category_id,COALESCE(c.name,o.legacy_category_label) AS category,o.brand,o.model,o.description,o.lead_time_value,o.lead_time_unit,o.credit_type,o.credit_days,o.currency_code,o.minimum_order_text,o.valid_until,o.coverage,o.status_code,o.notes FROM supplier_offerings o LEFT JOIN categories c ON c.id=o.category_id AND c.organization_id=o.organization_id WHERE o.organization_id=? AND o.id=?', 'ii', [$org, $id]) ?? [];
    }

    private function resolve(int $org, array $p, ?array $before): array
    {
        $cat = $p['category'] !== '' ? $this->one('SELECT id FROM categories WHERE organization_id=? AND name=? AND active=1 ORDER BY id LIMIT 1', 'is', [$org, $p['category']]) : null;
        $status = self::choice($p['status'], OfferingInput::STATUSES, $before['status_code'] ?? null, 'estatus');
        return [
            'type' => self::choice($p['type'], OfferingInput::TYPES, $before['offering_type'] ?? null, 'tipo', true), // "Otro/agregar nuevo tipo": texto libre
            'category_id' => $cat ? (int) $cat['id'] : null,
            'category_label' => $cat || $p['category'] === '' ? null : $p['category'],
            'status' => $status ?? 'active',
            'credit_type' => self::choice($p['credit_type'], OfferingInput::CREDIT_TYPES, $before['credit_type'] ?? null, 'tipo de crédito'),
            'lead_unit' => self::choice($p['lead_time_unit'], OfferingInput::LEAD_UNITS, $before['lead_time_unit'] ?? null, 'unidad del tiempo'),
        ];
    }

    private function version(int $org, int $id): int
    {
        return (int) ($this->one('SELECT ' . self::VERSION . ' AS v FROM supplier_offerings o WHERE o.organization_id=? AND o.id=?', 'ii', [$org, $id])['v'] ?? 1);
    }

    /** @return array{id:string,version:int,code:string,replayed:bool} */
    public function create(int $org, int $actor, array $p, string $key): array
    {
        $endpoint = 'catalog.offerings.create';
        $this->db->begin_transaction();
        try {
            if ($replay = $this->idempotency($org, $actor, $endpoint, $key, self::fingerprint($p))) {
                $this->db->commit();
                return $replay;
            }
            $supplierId = (int) $this->supplier($org, $p['supplier_id'])['id'];
            $this->assertNameFree($org, $supplierId, $p['name'], null);
            $r = $this->resolve($org, $p, null);
            $public = self::uuid();
            $this->exec('INSERT INTO supplier_offerings (organization_id,supplier_id,public_id,name,offering_type,category_id,legacy_category_label,brand,model,description,lead_time_value,lead_time_unit,credit_type,credit_days,currency_code,minimum_order_text,valid_until,coverage,status_code,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',
                'iisssisssssssissssss', [$org, $supplierId, $public, $p['name'], $r['type'], $r['category_id'], $r['category_label'], $p['brand'] ?: null, $p['model'] ?: null, $p['description'] ?: null,
                $p['lead_time_value'], $r['lead_unit'], $r['credit_type'], $p['credit_days'], $p['currency'] ?: null, $p['minimum_order'] ?: null, $p['valid_until'], $p['coverage'] ?: null, $r['status'], $p['notes'] ?: null]);
            $id = (int) $this->db->insert_id;
            $this->audit($org, $supplierId, $actor, 'offering.create', ['offering' => $public, 'after' => $this->snapshot($org, $id)]);
            $response = ['id' => $public, 'version' => $this->version($org, $id), 'code' => $p['name'], 'replayed' => false];
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
        $endpoint = 'catalog.offerings.update:' . $publicId;
        $this->db->begin_transaction();
        try {
            if ($replay = $this->idempotency($org, $actor, $endpoint, $key, self::fingerprint($p + ['_version' => $version]))) {
                $this->db->commit();
                return $replay;
            }
            $row = $this->one('SELECT o.id,o.supplier_id,' . self::VERSION . ' AS v FROM supplier_offerings o WHERE o.organization_id=? AND o.public_id=? FOR UPDATE', 'is', [$org, $publicId]);
            if (! $row) {
                throw new CatalogConflict('NOT_FOUND', 'Suministro no encontrado.');
            }
            $id = (int) $row['id'];
            if ((int) $row['v'] !== $version) {
                throw new CatalogStale('El suministro cambió desde que se abrió. Recarga la ficha antes de guardar.');
            }
            $before = $this->snapshot($org, $id);
            $supplierId = (int) $this->supplier($org, $p['supplier_id'])['id'];
            $this->assertNameFree($org, $supplierId, $p['name'], $id);
            $r = $this->resolve($org, $p, $before);
            $this->exec("UPDATE supplier_offerings SET supplier_id=?,name=?,offering_type=?,category_id=?,legacy_category_label=?,brand=?,model=?,description=?,lead_time_value=?,lead_time_unit=?,credit_type=?,credit_days=?,currency_code=?,minimum_order_text=?,valid_until=?,coverage=?,status_code=?,notes=?,updated_at=GREATEST(UTC_TIMESTAMP(6),COALESCE(updated_at,'2000-01-01') + INTERVAL 1 MICROSECOND) WHERE organization_id=? AND id=?",
                'ississsssssissssssii', [$supplierId, $p['name'], $r['type'], $r['category_id'], $r['category_label'], $p['brand'] ?: null, $p['model'] ?: null, $p['description'] ?: null,
                $p['lead_time_value'], $r['lead_unit'], $r['credit_type'], $p['credit_days'], $p['currency'] ?: null, $p['minimum_order'] ?: null, $p['valid_until'], $p['coverage'] ?: null, $r['status'], $p['notes'] ?: null, $org, $id]);
            $after = $this->snapshot($org, $id);
            $changes = self::diff($before, $after);
            $newVersion = $this->version($org, $id);
            $this->audit($org, $supplierId, $actor, 'offering.update', ['offering' => $publicId, 'changes' => $changes]);
            $response = ['id' => $publicId, 'version' => $newVersion, 'code' => $p['name'], 'replayed' => false, 'changed' => array_keys($changes)];
            $this->finish($org, $actor, $endpoint, $key, $response);
            $this->db->commit();
            return $response;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }
}
