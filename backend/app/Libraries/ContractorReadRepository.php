<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

/**
 * Contratista · read-only (SELECT). The contractor company of SupplyFlow is the organization of the session
 * (`organizations`: legal name, tax id, contact, address, status, logo reference and responsible person), the one used
 * for documents and operations. Its personnel are the people of the organization (`people`, with their system access
 * from `users`). Other companies cannot be read: every query is scoped to the session organization. Password hashes,
 * login identifiers and storage paths are never selected.
 */
final class ContractorReadRepository
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

    private static function like(string $q): string
    {
        return '%' . strtr($q, ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
    }

    /** @param array{q:string,status:string} $f */
    public function list(int $org, array $f): array
    {
        $where = ''; $binds = [$org];
        if ($f['q'] !== '') {
            $l = self::like($f['q']);
            $where .= " AND (o.legal_name LIKE ? ESCAPE '!' OR o.tax_identifier LIKE ? ESCAPE '!' OR o.email LIKE ? ESCAPE '!' OR o.postal_address LIKE ? ESCAPE '!' OR o.phone LIKE ? ESCAPE '!')";
            array_push($binds, $l, $l, $l, $l, $l);
        }
        if ($f['status'] === 'active') {
            $where .= " AND o.status_code='active'";
        } elseif ($f['status'] === 'inactive') {
            $where .= " AND o.status_code<>'active'";
        }
        $items = $this->rows(<<<SQL
            SELECT o.public_id AS id,o.legal_name,o.tax_identifier,o.phone,o.email,o.postal_address,o.status_code AS status,o.business_timezone AS timezone,
                   (o.logo_file_id IS NOT NULL) AS has_logo,o.updated_at,
                   p.display_name AS responsible_name,p.position_title AS responsible_position,p.email AS responsible_email,p.phone AS responsible_phone,
                   (SELECT COUNT(*) FROM people x WHERE x.organization_id=o.id AND x.active=1) AS personnel,
                   (SELECT COUNT(*) FROM people x WHERE x.organization_id=o.id) AS personnel_total,
                   (SELECT COUNT(*) FROM users u WHERE u.organization_id=o.id AND u.access_enabled=1 AND u.status_code='active') AS with_access,
                   (SELECT COUNT(*) FROM requisitions r JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id WHERE r.organization_id=o.id AND e.archived_at IS NULL) AS requisitions,
                   (SELECT COUNT(DISTINCT po.series_public_id) FROM purchase_orders po WHERE po.organization_id=o.id) AS purchase_orders,
                   (SELECT COUNT(*) FROM deliveries d WHERE d.organization_id=o.id) AS deliveries,
                   (SELECT COUNT(*) FROM invoices i WHERE i.organization_id=o.id) AS invoices
            FROM organizations o
            LEFT JOIN people p ON p.id=o.primary_contact_person_id AND p.organization_id=o.id
            WHERE o.id=? {$where}
            SQL, $binds);
        foreach ($items as &$r) {
            $r['has_logo'] = (bool) $r['has_logo'];
            $r['active'] = true; // the session organization is the contractor in use for documents and operations
            $r['responsible'] = $r['responsible_name'] === null ? null
                : ['name' => $r['responsible_name'], 'position' => $r['responsible_position'], 'email' => $r['responsible_email'], 'phone' => $r['responsible_phone']];
            unset($r['responsible_name'], $r['responsible_position'], $r['responsible_email'], $r['responsible_phone']);
            foreach (['personnel', 'personnel_total', 'with_access', 'requisitions', 'purchase_orders', 'deliveries', 'invoices'] as $k) {
                $r[$k] = (int) $r[$k];
            }
            $r['usage'] = ['requisitions' => $r['requisitions'], 'purchase_orders' => $r['purchase_orders'], 'deliveries' => $r['deliveries'], 'invoices' => $r['invoices']];
            unset($r['requisitions'], $r['purchase_orders'], $r['deliveries'], $r['invoices']);
        }
        unset($r);
        $self = $this->rows('SELECT public_id,status_code FROM organizations WHERE id=?', [$org])[0] ?? null;
        return ['items' => $items, 'total' => count($items), 'active_id' => $self['public_id'] ?? null,
            'summary' => ['companies' => $self ? 1 : 0, 'active' => ($self['status_code'] ?? '') === 'active' ? 1 : 0]];
    }

    /** Personnel / contacts of the contractor (people of the session organization). Null when the id is not the session organization. */
    public function personnel(int $org, string $id): ?array
    {
        $o = $this->rows('SELECT id,public_id,legal_name,primary_contact_person_id FROM organizations WHERE id=? AND public_id=?', [$org, $id])[0] ?? null;
        if (! $o) {
            return null;
        }
        $people = $this->rows(<<<'SQL'
            SELECT p.public_id AS id,p.display_name AS name,p.position_title AS position,p.email,p.phone,p.active,
                   (u.id IS NOT NULL) AS has_user,COALESCE(u.access_enabled,0) AS access_enabled,u.status_code AS user_status,(p.id<=>?) AS responsible,
                   (SELECT GROUP_CONCAT(DISTINCT ro.name ORDER BY ro.name SEPARATOR ', ') FROM user_roles ur JOIN roles ro ON ro.id=ur.role_id AND ro.organization_id=ur.organization_id
                      WHERE ur.organization_id=u.organization_id AND ur.user_id=u.id) AS roles
            FROM people p LEFT JOIN users u ON u.person_id=p.id AND u.organization_id=p.organization_id
            WHERE p.organization_id=?
            ORDER BY responsible DESC,p.active DESC,p.display_name,p.id
            LIMIT 500
            SQL, [$o['primary_contact_person_id'], $org]);
        foreach ($people as &$p) {
            foreach (['active', 'has_user', 'access_enabled', 'responsible'] as $k) {
                $p[$k] = (bool) $p[$k];
            }
        }
        unset($p);
        return ['contractor' => ['id' => $o['public_id'], 'legal_name' => $o['legal_name']], 'items' => $people, 'total' => count($people)];
    }
}
