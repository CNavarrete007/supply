<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * Read-only supplier offerings catalog ("Suministros de proveedores") through the SELECT-only API account.
 * Prices are intentionally NOT part of this catalog: they are only recorded with formal supplier quotes.
 */
final class SupplierOfferingReadRepository
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
            throw new RuntimeException('OFFERINGS_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    private static function like(string $value): string
    {
        return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $value) . '%';
    }

    /** @param array{page:int,page_size:int,q:string,status:string,supplier:string} $f */
    public function list(int $org, array $f): array
    {
        $from = ' FROM supplier_offerings o'
            . ' JOIN suppliers s ON s.id=o.supplier_id AND s.organization_id=o.organization_id'
            . " JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id AND se.entity_kind='supplier' AND se.archived_at IS NULL"
            . ' LEFT JOIN categories cat ON cat.id=o.category_id AND cat.organization_id=o.organization_id';
        $where = ['o.organization_id=?'];
        $binds = [$org];
        if ($f['supplier'] !== 'all') { $where[] = 'se.public_id=?'; $binds[] = $f['supplier']; }
        if ($f['status'] !== 'all') { $where[] = 'o.status_code=?'; $binds[] = $f['status']; }
        if ($f['q'] !== '') {
            $fields = ['o.name', 'o.offering_type', 'o.brand', 'o.model', 'o.description', 'o.coverage', 'cat.name', 'o.legacy_category_label', 's.legal_name', 's.code'];
            $where[] = '(' . implode(' OR ', array_map(static fn (string $x): string => $x . " LIKE ? ESCAPE '!'", $fields)) . ')';
            foreach ($fields as $_) { $binds[] = self::like($f['q']); }
        }
        $whereSql = ' WHERE ' . implode(' AND ', $where);
        $total = (int) ($this->rows('SELECT COUNT(*) AS n' . $from . $whereSql, $binds)[0]['n'] ?? 0);
        $items = $this->rows(<<<SQL
            SELECT o.public_id AS id,se.public_id AS supplier_id,s.code AS supplier_code,s.legal_name AS supplier_name,
              o.name,o.offering_type AS type,COALESCE(cat.name,o.legacy_category_label) AS category,o.brand,o.model,o.description,
              o.lead_time_value,o.lead_time_unit,o.credit_type,o.credit_days,o.currency_code AS currency,o.minimum_order_text AS minimum_order,
              o.valid_until,o.coverage,o.status_code AS status,o.notes,o.updated_at,
              COALESCE(TIMESTAMPDIFF(MICROSECOND,'2000-01-01 00:00:00',o.updated_at),1) AS version
            {$from}{$whereSql} ORDER BY s.legal_name,o.name,o.id LIMIT ? OFFSET ?
            SQL, [...$binds, $f['page_size'], ($f['page'] - 1) * $f['page_size']]);
        foreach ($items as &$item) {
            $item['credit_days'] = $item['credit_days'] === null ? null : (int) $item['credit_days'];
            $item['version'] = (int) $item['version']; // optimistic-concurrency token for PUT (If-Match)
        }
        unset($item);
        // Summary over the whole catalog (unfiltered) so the supplier cards always describe the source data.
        $statuses = array_map(static fn (array $r): array => ['code' => (string) $r['code'], 'count' => (int) $r['count']],
            $this->rows('SELECT o.status_code AS code,COUNT(*) AS count FROM supplier_offerings o WHERE o.organization_id=? GROUP BY o.status_code ORDER BY o.status_code', [$org]));
        $suppliers = array_map(static fn (array $r): array => ['id' => $r['id'], 'code' => $r['code'], 'name' => $r['name'], 'total' => (int) $r['total'], 'active' => (int) $r['active']],
            $this->rows(<<<'SQL'
                SELECT se.public_id AS id,s.code,s.legal_name AS name,COUNT(*) AS total,COALESCE(SUM(o.status_code IN ('active','available')),0) AS active
                FROM supplier_offerings o
                JOIN suppliers s ON s.id=o.supplier_id AND s.organization_id=o.organization_id
                JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id AND se.entity_kind='supplier' AND se.archived_at IS NULL
                WHERE o.organization_id=? GROUP BY se.public_id,s.code,s.legal_name ORDER BY total DESC,s.legal_name LIMIT 500
                SQL, [$org]));
        $types = array_map(static fn (array $r): array => ['code' => (string) $r['code'], 'count' => (int) $r['count']],
            $this->rows('SELECT o.offering_type AS code,COUNT(*) AS count FROM supplier_offerings o WHERE o.organization_id=? AND o.offering_type IS NOT NULL GROUP BY o.offering_type ORDER BY count DESC', [$org]));
        return [
            'items' => $items, 'total' => $total, 'page' => $f['page'], 'page_size' => $f['page_size'],
            'summary' => ['total' => array_sum(array_column($statuses, 'count')), 'statuses' => $statuses, 'suppliers' => $suppliers, 'types' => $types],
            'notes' => ['Catálogo sin precios: el precio se registra únicamente con la cotización formal del proveedor.'],
        ];
    }

    /** One offering by public id (same fields as list items, including the version token). */
    public function detail(int $org, string $publicId): ?array
    {
        $rows = $this->rows(<<<'SQL'
            SELECT o.public_id AS id,se.public_id AS supplier_id,s.code AS supplier_code,s.legal_name AS supplier_name,
              o.name,o.offering_type AS type,COALESCE(cat.name,o.legacy_category_label) AS category,o.brand,o.model,o.description,
              o.lead_time_value,o.lead_time_unit,o.credit_type,o.credit_days,o.currency_code AS currency,o.minimum_order_text AS minimum_order,
              o.valid_until,o.coverage,o.status_code AS status,o.notes,o.updated_at,
              COALESCE(TIMESTAMPDIFF(MICROSECOND,'2000-01-01 00:00:00',o.updated_at),1) AS version
            FROM supplier_offerings o
            JOIN suppliers s ON s.id=o.supplier_id AND s.organization_id=o.organization_id
            JOIN business_entities se ON se.id=s.id AND se.organization_id=s.organization_id AND se.entity_kind='supplier' AND se.archived_at IS NULL
            LEFT JOIN categories cat ON cat.id=o.category_id AND cat.organization_id=o.organization_id
            WHERE o.organization_id=? AND o.public_id=? LIMIT 1
            SQL, [$org, $publicId]);
        if (! $rows) {
            return null;
        }
        $item = $rows[0];
        $item['credit_days'] = $item['credit_days'] === null ? null : (int) $item['credit_days'];
        $item['version'] = (int) $item['version'];
        return $item;
    }
}
