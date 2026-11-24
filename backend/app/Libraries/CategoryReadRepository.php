<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

/**
 * Requisición › Catálogo de categorías · read-only (SELECT). Lists the organization categories with their usage:
 * requisition lines linked by `category_id`, historical lines that only carry the same label (`category_label_snapshot`,
 * e.g. imported lines whose category could not be resolved), distinct requisitions, suppliers and supplier offerings.
 * The usage is what decides whether a category can be deleted or should be deactivated instead (foreign keys from
 * requisition_items, suppliers and supplier_offerings). Internal numeric ids are never returned: `code` is the key.
 * Alta, edición y eliminación: CategoryWriteController (cuenta catalogwrite); `version` es la huella que exige If-Match.
 */
final class CategoryReadRepository
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

    /**
     * Versión de una categoría para If-Match: huella SHA-256 (16 hex) de código, nombre, descripción y estatus. La tabla no tiene
     * columna de versión; cualquier cambio de esos campos cambia la huella (CategoryWriteRepository la exige al editar o eliminar).
     */
    public static function version(array $c): string
    {
        return substr(hash('sha256', json_encode([(string) $c['code'], (string) $c['name'], (string) ($c['description'] ?? ''), (bool) $c['active']], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)), 0, 16);
    }

    /** @return array<string,mixed> */
    public function catalog(int $org): array
    {
        $rows = $this->rows(<<<'SQL'
            SELECT c.code, c.name, c.description, c.active, c.legacy_id IS NOT NULL AS imported,
              (SELECT COUNT(*) FROM requisition_items i WHERE i.organization_id = c.organization_id AND i.category_id = c.id) AS items,
              (SELECT COUNT(*) FROM requisition_items i WHERE i.organization_id = c.organization_id AND i.category_id IS NULL
                 AND i.category_label_snapshot = c.name) AS items_by_label,
              (SELECT COUNT(DISTINCT i.requisition_id) FROM requisition_items i WHERE i.organization_id = c.organization_id
                 AND (i.category_id = c.id OR (i.category_id IS NULL AND i.category_label_snapshot = c.name))) AS requisitions,
              (SELECT COUNT(*) FROM suppliers s WHERE s.organization_id = c.organization_id AND s.category_id = c.id) AS suppliers,
              (SELECT COUNT(*) FROM supplier_offerings o WHERE o.organization_id = c.organization_id AND o.category_id = c.id) AS offerings
            FROM categories c
            WHERE c.organization_id = ?
            ORDER BY c.name, c.code
            LIMIT 1000
            SQL, [$org]);
        $items = [];
        foreach ($rows as $r) {
            $usage = ['items' => (int) $r['items'], 'items_by_label' => (int) $r['items_by_label'], 'requisitions' => (int) $r['requisitions'],
                'suppliers' => (int) $r['suppliers'], 'offerings' => (int) $r['offerings']];
            $item = ['code' => (string) $r['code'], 'name' => (string) $r['name'], 'description' => $r['description'] === null ? null : (string) $r['description'],
                'active' => (bool) $r['active'], 'imported' => (bool) $r['imported'], 'usage' => $usage];
            $item['version'] = self::version($item);
            $items[] = $item;
        }
        $unlinked = $this->rows(<<<'SQL'
            SELECT COUNT(*) AS n FROM requisition_items i
            WHERE i.organization_id = ? AND i.category_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.organization_id = i.organization_id AND c.name = i.category_label_snapshot)
            SQL, [$org]);
        $active = count(array_filter($items, static fn (array $c): bool => $c['active']));
        return [
            'items' => $items,
            'totals' => ['categories' => count($items), 'active' => $active, 'inactive' => count($items) - $active,
                'items' => array_sum(array_map(static fn (array $c): int => $c['usage']['items'] + $c['usage']['items_by_label'], $items)),
                'unlinked_items' => (int) ($unlinked[0]['n'] ?? 0)],
            'read_only' => false,
        ];
    }
}
