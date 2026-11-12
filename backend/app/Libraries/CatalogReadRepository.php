<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * Read-only, organization-scoped client and supplier directory.
 * Connects through the EXISTING supplyflow_api_local SELECT-only account.
 * No mutation or independent user/permission data is introduced here.
 */
final class CatalogReadRepository
{
    private BaseConnection $db;

    public function __construct()
    {
        $this->db = Database::connect();
        $this->db->initialize(); // SessionMySQLi applies and checks the MariaDB session contract.
    }

    private function queryRows(string $sql, array $binds): array
    {
        $result = $this->db->query($sql, $binds);
        if ($result === false) {
            throw new RuntimeException('CATALOG_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    private function queryOne(string $sql, array $binds): ?array
    {
        $result = $this->db->query($sql, $binds);
        if ($result === false) {
            throw new RuntimeException('CATALOG_QUERY_FAILED');
        }
        return $result->getRowArray() ?: null;
    }

    private function escapeLike(string $value): string
    {
        return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $value) . '%';
    }

    private function context(string $kind): array
    {
        if ($kind === 'clients') {
            return [
                'table' => 'clients',
                'alias' => 'c',
                'kind' => 'client',
                'fields' => ['c.code', 'c.legal_name', 'c.brand_name', 'c.tax_identifier', 'c.default_project_reference', 'c.default_contract_reference'],
            ];
        }
        if ($kind === 'suppliers') {
            return [
                'table' => 'suppliers',
                'alias' => 's',
                'kind' => 'supplier',
                'fields' => ['s.code', 's.legal_name', 's.supplier_key', 's.tax_identifier', 's.legacy_category_label'],
            ];
        }
        throw new RuntimeException('CATALOG_UNKNOWN');
    }

    /**
     * @return array{items:list<array<string,mixed>>,total:int,page:int,page_size:int,summary:array<string,mixed>}
     */
    public function list(string $kind, int $organizationId, int $page, int $pageSize, string $search, string $status): array
    {
        $c = $this->context($kind); // all SQL table/field identifiers from server-side allowlists
        $table = $c['table'];
        $alias = $c['alias'];
        $baseJoin = " FROM {$table} {$alias} JOIN business_entities e ON e.id={$alias}.id AND e.organization_id={$alias}.organization_id";
        $baseWhere = "{$alias}.organization_id=? AND e.entity_kind=? AND e.archived_at IS NULL";
        $binds = [$organizationId, $c['kind']];
        $where = $baseWhere;
        if ($status !== 'all') {
            $where .= " AND {$alias}.status_code=?";
            $binds[] = $status;
        }
        if ($search !== '') {
            $conditions = array_map(static fn ($field) => "$field LIKE ? ESCAPE '!'", $c['fields']);
            $conditions[] = "EXISTS (SELECT 1 FROM party_contact_channels ch WHERE ch.organization_id={$alias}.organization_id AND ch.owner_entity_id={$alias}.id AND ch.value LIKE ? ESCAPE '!')";
            $conditions[] = "EXISTS (SELECT 1 FROM party_contacts pc WHERE pc.organization_id={$alias}.organization_id AND pc.owner_entity_id={$alias}.id AND pc.display_name LIKE ? ESCAPE '!')";
            $where .= ' AND (' . implode(' OR ', $conditions) . ')';
            $pattern = $this->escapeLike($search);
            for ($i = 0, $n = count($conditions); $i < $n; $i++) {
                $binds[] = $pattern;
            }
        }

        $counter = $this->queryOne('SELECT COUNT(*) AS n' . $baseJoin . ' WHERE ' . $where, $binds);
        $total = (int) ($counter['n'] ?? 0);
        $offset = ($page - 1) * $pageSize;

        if ($kind === 'clients') {
            $projection = <<<'SQL'
                e.public_id AS id,c.code,c.legal_name AS name,c.brand_name,c.tax_identifier AS tax_id,
                c.default_project_reference AS project,c.default_contract_reference AS contract_reference,
                c.status_code AS status,c.legacy_status,c.data_incomplete,c.portal_enabled,
                (SELECT COUNT(*) FROM requisitions req WHERE req.organization_id=c.organization_id AND req.client_id=c.id) AS requisition_count,
                (SELECT pc.display_name FROM party_contacts pc WHERE pc.organization_id=c.organization_id AND pc.owner_entity_id=c.id ORDER BY pc.is_primary DESC,pc.source_ordinal,pc.id LIMIT 1) AS primary_contact,
                (SELECT ch.value FROM party_contact_channels ch WHERE ch.organization_id=c.organization_id AND ch.owner_entity_id=c.id AND ch.channel_type='email' ORDER BY ch.is_primary DESC,ch.source_ordinal,ch.id LIMIT 1) AS primary_email
                SQL;
        } else {
            $projection = <<<'SQL'
                e.public_id AS id,s.code,s.supplier_key,s.legal_name AS name,s.tax_identifier AS tax_id,
                s.status_code AS status,s.legacy_status,s.data_incomplete,
                COALESCE(cat.name,s.legacy_category_label) AS category,
                s.default_currency AS currency,s.credit_type,s.credit_days,s.lead_time_value,s.lead_time_unit,s.rating,
                (SELECT COUNT(*) FROM supplier_offerings so WHERE so.organization_id=s.organization_id AND so.supplier_id=s.id) AS offerings_count,
                (SELECT pc.display_name FROM party_contacts pc WHERE pc.organization_id=s.organization_id AND pc.owner_entity_id=s.id ORDER BY pc.is_primary DESC,pc.source_ordinal,pc.id LIMIT 1) AS primary_contact,
                (SELECT ch.value FROM party_contact_channels ch WHERE ch.organization_id=s.organization_id AND ch.owner_entity_id=s.id AND ch.channel_type='email' ORDER BY ch.is_primary DESC,ch.source_ordinal,ch.id LIMIT 1) AS primary_email
                SQL;
            $baseJoin .= ' LEFT JOIN categories cat ON cat.id=s.category_id AND cat.organization_id=s.organization_id';
        }
        $rows = $this->queryRows("SELECT {$projection}" . $baseJoin . ' WHERE ' . $where . " ORDER BY {$alias}.legal_name,{$alias}.id LIMIT ? OFFSET ?", [...$binds, $pageSize, $offset]);
        $items = array_map(static function (array $row): array {
            foreach (['data_incomplete', 'portal_enabled'] as $field) {
                if (array_key_exists($field, $row)) {
                    $row[$field] = (bool) $row[$field];
                }
            }
            foreach (['requisition_count', 'offerings_count'] as $field) {
                if (array_key_exists($field, $row)) {
                    $row[$field] = (int) $row[$field];
                }
            }
            return $row;
        }, $rows);

        $statuses = $this->queryRows("SELECT {$alias}.status_code AS code,COUNT(*) AS n" .
            " FROM {$table} {$alias} JOIN business_entities e ON e.id={$alias}.id AND e.organization_id={$alias}.organization_id" .
            " WHERE {$baseWhere} GROUP BY {$alias}.status_code ORDER BY {$alias}.status_code", [$organizationId, $c['kind']]);
        $all = 0;
        foreach ($statuses as &$entry) {
            $entry['count'] = (int) $entry['n'];
            unset($entry['n']);
            $all += $entry['count'];
        }
        unset($entry);
        $incomplete = $this->queryOne("SELECT COUNT(*) AS n FROM {$table} {$alias}" .
            ' JOIN business_entities e ON e.id=' . $alias . '.id AND e.organization_id=' . $alias . '.organization_id' .
            " WHERE {$baseWhere} AND {$alias}.data_incomplete=1", [$organizationId, $c['kind']]);

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
            'summary' => ['total' => $all, 'statuses' => $statuses, 'incomplete' => (int) ($incomplete['n'] ?? 0)],
        ];
    }

    /** @return array<string,mixed>|null */
    public function detail(string $kind, int $organizationId, string $publicId): ?array
    {
        $c = $this->context($kind);
        $table = $c['table'];
        $alias = $c['alias'];
        if ($kind === 'clients') {
            $fields = <<<'SQL'
                c.code,c.legal_name AS name,c.brand_name,c.tax_identifier AS tax_id,
                c.status_code AS status,c.legacy_status,c.data_incomplete,c.portal_enabled,c.portal_locked,
                c.default_project_reference AS project,c.default_contract_reference AS contract_reference,
                c.address_text AS address,c.commercial_terms AS terms,c.notes,
                c.repeat_sales_policy,c.repeat_sourcing_policy,c.repeat_price_validity_days,c.repeat_contract_reference,
                c.repeat_contract_valid_until,c.repeat_min_margin_pct,c.repeat_policy_updated_at
                SQL;
            $extra = '';
        } else {
            $fields = <<<'SQL'
                s.code,s.legal_name AS name,s.supplier_key,s.tax_identifier AS tax_id,
                s.status_code AS status,s.legacy_status,s.data_incomplete,s.notes,s.document_notes,
                s.default_currency AS currency,s.credit_type,s.credit_days,s.lead_time_value,
                s.lead_time_unit,s.rating,s.rating_scale,
                COALESCE(cat.name,s.legacy_category_label) AS category
                SQL;
            $extra = ' LEFT JOIN categories cat ON cat.id=s.category_id AND cat.organization_id=s.organization_id';
        }
        $row = $this->queryOne("SELECT e.public_id AS id, {$fields} FROM {$table} {$alias}" .
            " JOIN business_entities e ON e.id={$alias}.id AND e.organization_id={$alias}.organization_id" . $extra .
            " WHERE {$alias}.organization_id=? AND e.entity_kind=? AND e.archived_at IS NULL AND e.public_id=? LIMIT 1", [$organizationId, $c['kind'], $publicId]);
        if (! $row) {
            return null;
        }
        foreach (['data_incomplete', 'portal_enabled', 'portal_locked'] as $field) {
            if (isset($row[$field])) {
                $row[$field] = (bool) $row[$field];
            }
        }
        if ($kind === 'clients') {
            // Repeat-purchase pricing policy (read-only). Codes are returned exactly as stored; DECIMAL stays a string.
            $row['repeat_policy'] = [
                'sales_policy' => $row['repeat_sales_policy'],
                'sourcing_policy' => $row['repeat_sourcing_policy'],
                'price_validity_days' => $row['repeat_price_validity_days'] === null ? null : (int) $row['repeat_price_validity_days'],
                'contract_reference' => $row['repeat_contract_reference'],
                'contract_valid_until' => $row['repeat_contract_valid_until'],
                'min_margin_pct' => $row['repeat_min_margin_pct'],
                'updated_at' => $row['repeat_policy_updated_at'],
            ];
            foreach (['repeat_sales_policy', 'repeat_sourcing_policy', 'repeat_price_validity_days', 'repeat_contract_reference',
                'repeat_contract_valid_until', 'repeat_min_margin_pct', 'repeat_policy_updated_at'] as $field) {
                unset($row[$field]);
            }
        }
        $owner = $this->queryOne('SELECT id FROM business_entities WHERE public_id=? AND organization_id=? AND entity_kind=? AND archived_at IS NULL LIMIT 1', [$publicId, $organizationId, $c['kind']]);
        if (! $owner) {
            return null;
        }
        $entityId = (int) $owner['id'];
        // Additive (write support): optimistic-concurrency version, import origin and current logo (metadata only).
        $meta = $this->queryOne('SELECT row_version,imported_at FROM business_entities WHERE id=? AND organization_id=?', [$entityId, $organizationId]);
        $row['version'] = (int) ($meta['row_version'] ?? 1);
        $row['imported'] = ($meta['imported_at'] ?? null) !== null;
        $logo = $this->queryOne('SELECT f.detected_mime AS mime,f.size_bytes AS size,ef.original_filename AS name FROM entity_files ef JOIN files f ON f.id=ef.file_id AND f.organization_id=ef.organization_id WHERE ef.organization_id=? AND ef.entity_id=? AND ef.file_role=? ORDER BY ef.id DESC LIMIT 1', [$organizationId, $entityId, $kind === 'clients' ? 'clientLogo' : 'supplierLogo']);
        $row['logo'] = $logo ? ['mime' => $logo['mime'], 'size' => (int) $logo['size'], 'name' => $logo['name']] : null;
        $row['contacts'] = $this->queryRows('SELECT public_id AS id,display_name AS name,position_title AS position,is_primary FROM party_contacts WHERE organization_id=? AND owner_entity_id=? AND active=1 ORDER BY is_primary DESC,source_ordinal,id LIMIT 200', [$organizationId, $entityId]);
        $row['channels'] = $this->queryRows('SELECT channel_type AS type,value,source_field,is_primary FROM party_contact_channels WHERE organization_id=? AND owner_entity_id=? ORDER BY is_primary DESC,source_ordinal,id LIMIT 200', [$organizationId, $entityId]);
        foreach ($row['contacts'] as &$contact) {
            $contact['is_primary'] = (bool) $contact['is_primary'];
        }
        unset($contact);
        foreach ($row['channels'] as &$channel) {
            $channel['is_primary'] = (bool) $channel['is_primary'];
        }
        unset($channel);
        // No portal access codes, legacy password digests or private file paths are returned.
        return $row;
    }

    /** Storage of the current logo of a client/supplier (for the authorized GET .../logo endpoint). Never sent to the browser. */
    public function entityLogo(int $organizationId, string $entityKind, string $role, string $publicId): ?array
    {
        if (! in_array([$entityKind, $role], [['client', 'clientLogo'], ['supplier', 'supplierLogo']], true)) {
            return null;
        }
        return $this->queryOne('SELECT f.storage_backend,f.storage_key,f.detected_mime AS mime,LOWER(HEX(f.sha256)) AS sha256 FROM business_entities e JOIN entity_files ef ON ef.entity_id=e.id AND ef.organization_id=e.organization_id AND ef.file_role=? JOIN files f ON f.id=ef.file_id AND f.organization_id=ef.organization_id WHERE e.organization_id=? AND e.public_id=? AND e.entity_kind=? AND e.archived_at IS NULL ORDER BY ef.id DESC LIMIT 1', [$role, $organizationId, $publicId, $entityKind]);
    }
}
