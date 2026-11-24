<?php

declare(strict_types=1);

namespace App\Libraries;

use Throwable;

/**
 * Catálogo de categorías · alta, edición (nombre, descripción, estatus) y eliminación con la cuenta supplyflow_catalogwrite_local
 * (ver CatalogWriteBase: idempotencia y conexión). La tabla no tiene columna de versión: la versión es la huella SHA-256 de la fila
 * (CategoryReadRepository::version) y se exige en If-Match. Reglas del Apps Script original: no duplicar nombres (sin distinguir
 * mayúsculas ni acentos, como la intercalación de la columna); una categoría usada (partidas, proveedores o suministros) no se
 * elimina, se desactiva; desactivar no cambia el historial. Las partidas existentes conservan su etiqueta histórica al renombrar.
 * La bitácora (audit_events, módulo "catalogs") guarda el código y el antes/después; las categorías no son business_entities.
 */
final class CategoryWriteRepository extends CatalogWriteBase
{
    private function row(int $org, string $code, bool $lock = true): ?array
    {
        $r = $this->one('SELECT id,code,name,description,active FROM categories WHERE organization_id=? AND code=?' . ($lock ? ' FOR UPDATE' : ''), 'is', [$org, $code]);
        if ($r) {
            $r['active'] = (bool) $r['active'];
        }
        return $r;
    }

    private static function public(array $r): array
    {
        return ['code' => $r['code'], 'name' => $r['name'], 'description' => $r['description'], 'active' => (bool) $r['active']];
    }

    private function assertNameFree(int $org, string $name, ?int $except): void
    {
        $dup = $this->one('SELECT id,name,active FROM categories WHERE organization_id=? AND name=?' . ($except ? ' AND id<>?' : '') . ' LIMIT 1 FOR UPDATE',
            $except ? 'isi' : 'is', $except ? [$org, $name, $except] : [$org, $name]);
        if ($dup) {
            throw new CatalogConflict('DUPLICATE_CATEGORY', (int) $dup['active'] === 1
                ? 'Ya existe la categoría «' . $dup['name'] . '». Usa la existente para no duplicar el catálogo.'
                : 'Ya existe la categoría «' . $dup['name'] . '» en estatus Inactiva. Reactívala desde la matriz en lugar de duplicarla.');
        }
    }

    /** Código nuevo con la convención del catálogo importado: "cat_" + nombre en minúsculas sin acentos; sufijo _2, _3… si existe. */
    private function newCode(int $org, string $name): string
    {
        $ascii = strtolower((string) (iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', strtr($name, ['ñ' => 'n', 'Ñ' => 'n'])) ?: ''));
        $slug = trim((string) preg_replace('/[^a-z0-9]+/', '_', $ascii), '_');
        $base = 'cat_' . ($slug !== '' ? substr($slug, 0, 50) : bin2hex(random_bytes(4)));
        $base = rtrim($base, '_');
        for ($i = 1; $i < 1000; $i++) {
            $code = $i === 1 ? $base : $base . '_' . $i;
            if (! $this->one('SELECT id FROM categories WHERE organization_id=? AND code=? FOR UPDATE', 'is', [$org, $code])) {
                return $code;
            }
        }
        throw new CatalogConflict('CODE_UNAVAILABLE', 'No fue posible asignar un código a la categoría.');
    }

    private function usage(int $org, array $r): array
    {
        $u = $this->one('SELECT (SELECT COUNT(*) FROM requisition_items i WHERE i.organization_id=? AND i.category_id=?) AS items,
            (SELECT COUNT(*) FROM requisition_items i WHERE i.organization_id=? AND i.category_id IS NULL AND i.category_label_snapshot=?) AS items_by_label,
            (SELECT COUNT(*) FROM suppliers s WHERE s.organization_id=? AND s.category_id=?) AS suppliers,
            (SELECT COUNT(*) FROM supplier_offerings o WHERE o.organization_id=? AND o.category_id=?) AS offerings', 'iiisiiii',
            [$org, (int) $r['id'], $org, $r['name'], $org, (int) $r['id'], $org, (int) $r['id']]) ?? [];
        return array_map('intval', $u);
    }

    private function log(int $org, int $actor, string $action, array $detail): void
    {
        $this->exec("INSERT INTO audit_events (organization_id,public_id,subject_entity_id,actor_user_id,module_code,action_code,result_code,occurred_at,recorded_at,changes_json,source_kind) VALUES (?,?,NULL,?,'catalogs',?,'success',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),?,'system')",
            'isiss', [$org, self::uuid(), $actor, $action, json_encode($detail, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
    }

    /** @return array{id:string,code:string,version:string,replayed:bool} */
    public function create(int $org, int $actor, array $p, string $key): array
    {
        $endpoint = 'catalog.categories.create';
        $this->db->begin_transaction();
        try {
            if ($replay = $this->idempotency($org, $actor, $endpoint, $key, self::fingerprint($p))) {
                $this->db->commit();
                return $replay;
            }
            $this->assertNameFree($org, $p['name'], null);
            $code = $this->newCode($org, $p['name']);
            $this->exec('INSERT INTO categories (organization_id,code,name,description,active) VALUES (?,?,?,?,?)', 'isssi', [$org, $code, $p['name'], $p['description'], $p['status'] === 'active' ? 1 : 0]);
            $after = self::public($this->row($org, $code));
            $this->log($org, $actor, 'category.create', ['category' => $code, 'after' => $after]);
            $response = ['id' => $code, 'code' => $code, 'version' => CategoryReadRepository::version($after), 'replayed' => false];
            $this->finish($org, $actor, $endpoint, $key, $response);
            $this->db->commit();
            return $response;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    /** @return array{id:string,code:string,version:string,replayed:bool,changed:list<string>} */
    public function update(int $org, int $actor, string $code, string $version, array $p, string $key): array
    {
        $endpoint = 'catalog.categories.update:' . $code;
        $this->db->begin_transaction();
        try {
            if ($replay = $this->idempotency($org, $actor, $endpoint, $key, self::fingerprint($p + ['_version' => $version]))) {
                $this->db->commit();
                return $replay;
            }
            $r = $this->row($org, $code);
            if (! $r) {
                throw new CatalogConflict('NOT_FOUND', 'Categoría no encontrada.');
            }
            $before = self::public($r);
            if (! hash_equals(CategoryReadRepository::version($before), $version)) {
                throw new CatalogStale('La categoría cambió desde que se abrió. Recarga el catálogo antes de guardar.');
            }
            $this->assertNameFree($org, $p['name'], (int) $r['id']);
            $this->exec('UPDATE categories SET name=?,description=?,active=? WHERE organization_id=? AND id=?', 'ssiii', [$p['name'], $p['description'], $p['status'] === 'active' ? 1 : 0, $org, (int) $r['id']]);
            $after = self::public($this->row($org, $code));
            $changes = self::diff($before, $after);
            if ($changes) {
                $this->log($org, $actor, 'category.update', ['category' => $code, 'changes' => $changes]);
            }
            $response = ['id' => $code, 'code' => $code, 'version' => CategoryReadRepository::version($after), 'replayed' => false, 'changed' => array_keys($changes)];
            $this->finish($org, $actor, $endpoint, $key, $response);
            $this->db->commit();
            return $response;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    /** Solo una categoría nunca usada se elimina; si tiene uso responde 409 CATEGORY_IN_USE (desactivarla en su lugar). */
    public function delete(int $org, int $actor, string $code, string $version, string $key): array
    {
        $endpoint = 'catalog.categories.delete:' . $code;
        $this->db->begin_transaction();
        try {
            if ($replay = $this->idempotency($org, $actor, $endpoint, $key, self::fingerprint(['_version' => $version]))) {
                $this->db->commit();
                return $replay;
            }
            $r = $this->row($org, $code);
            if (! $r) {
                throw new CatalogConflict('NOT_FOUND', 'Categoría no encontrada.');
            }
            $before = self::public($r);
            if (! hash_equals(CategoryReadRepository::version($before), $version)) {
                throw new CatalogStale('La categoría cambió desde que se abrió. Recarga el catálogo antes de eliminar.');
            }
            $u = $this->usage($org, $r);
            if (array_sum($u) > 0) {
                throw new CatalogConflict('CATEGORY_IN_USE', '«' . $r['name'] . '» ya tiene uso (' . ($u['items'] + $u['items_by_label']) . ' partida(s), ' . $u['suppliers'] . ' proveedor(es), ' . $u['offerings'] . ' suministro(s)). Desactívala en lugar de eliminarla para conservar el historial.');
            }
            $this->exec('DELETE FROM categories WHERE organization_id=? AND id=?', 'ii', [$org, (int) $r['id']]);
            $this->log($org, $actor, 'category.delete', ['category' => $code, 'before' => $before]);
            $response = ['id' => $code, 'code' => $code, 'deleted' => true, 'replayed' => false];
            $this->finish($org, $actor, $endpoint, $key, $response);
            $this->db->commit();
            return $response;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }
}
