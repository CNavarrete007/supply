<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

/**
 * Requisición › Crear desde historial · read-only (SELECT).
 * Returns the client's repeat-purchase policy (clients.repeat_*) and its historical catalog: the lines of APPROVED
 * customer quotes (legacy status "Aprobada", client decision approved, or a recorded `approved` decision; superseded
 * versions excluded) grouped by article (description + brand/model + unit), with the latest client unit price, the
 * cost basis (customer_quote_items.cost_amount = unit cost) and the active awarded supplier of the source line.
 * The history is reference only: nothing is copied or modified. Internal numeric ids are never returned.
 */
final class RequisitionHistoryReadRepository
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

    private static function fold(?string $v): string
    {
        $v = mb_strtolower(trim(preg_replace('/\s+/u', ' ', (string) $v) ?? ''), 'UTF-8');
        return strtr($v, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n', 'à' => 'a', 'è' => 'e', 'ì' => 'i', 'ò' => 'o', 'ù' => 'u']);
    }

    private static function num(mixed $v): ?float
    {
        return $v === null || $v === '' ? null : (float) $v;
    }

    /** @return array<string,mixed>|null null when the client does not exist in the organization. */
    public function catalog(int $org, string $clientPublicId): ?array
    {
        $c = $this->rows(<<<'SQL'
            SELECT c.id, ce.public_id, c.code, c.legal_name, c.status_code, c.default_project_reference, c.default_contract_reference,
                   c.repeat_sales_policy, c.repeat_sourcing_policy, c.repeat_price_validity_days, c.repeat_contract_reference,
                   c.repeat_contract_valid_until, c.repeat_min_margin_pct, c.repeat_policy_updated_at
            FROM clients c JOIN business_entities ce ON ce.id = c.id AND ce.organization_id = c.organization_id
            WHERE c.organization_id = ? AND ce.public_id = ? AND ce.archived_at IS NULL
            SQL, [$org, $clientPublicId]);
        if (! $c) {
            return null;
        }
        $c = $c[0];
        $lines = $this->rows(<<<'SQL'
            SELECT i.description, i.brand_model, i.unit_label, i.quantity, i.cost_amount, i.original_cost_amount, i.original_cost_currency,
                   i.unit_price, i.line_subtotal, i.line_number,
                   v.folio AS quote_folio, v.version_number, v.quote_date, v.currency_code, v.legacy_status, v.client_decision_status,
                   ve.public_id AS quote_version_id, ve.created_at AS quote_created_at,
                   r.folio AS requisition_folio, re.public_id AS requisition_id,
                   ri.category_label_snapshot AS category,
                   (SELECT s.legal_name FROM awards aw JOIN suppliers s ON s.id = aw.supplier_id AND s.organization_id = aw.organization_id
                     WHERE aw.organization_id = i.organization_id AND aw.requisition_item_id = i.requisition_item_id
                       AND aw.status_code = 'active' AND aw.superseded_at IS NULL ORDER BY aw.id DESC LIMIT 1) AS supplier
            FROM customer_quote_items i
            JOIN customer_quote_versions v ON v.id = i.customer_quote_version_id AND v.organization_id = i.organization_id
            JOIN business_entities ve ON ve.id = v.id AND ve.organization_id = v.organization_id
            JOIN requisitions r ON r.id = v.requisition_id AND r.organization_id = v.organization_id
            JOIN business_entities re ON re.id = r.id AND re.organization_id = r.organization_id
            LEFT JOIN requisition_items ri ON ri.id = i.requisition_item_id AND ri.organization_id = i.organization_id
            WHERE i.organization_id = ? AND r.client_id = ? AND ve.archived_at IS NULL AND re.archived_at IS NULL
              AND (v.legacy_status = 'Aprobada' OR v.client_decision_status IN ('approved', 'approved_legacy')
                   OR EXISTS (SELECT 1 FROM customer_quote_decisions d WHERE d.organization_id = v.organization_id
                              AND d.customer_quote_version_id = v.id AND d.decision_code = 'approved'))
              AND COALESCE(v.document_status, '') <> 'superseded' AND COALESCE(v.legacy_status, '') <> 'Sustituida'
            ORDER BY COALESCE(v.quote_date, DATE(ve.created_at)) DESC, v.version_number DESC, i.line_number, i.id
            LIMIT 5000
            SQL, [$org, (int) $c['id']]);
        $articles = [];
        $versions = [];
        foreach ($lines as $l) {
            $versions[$l['quote_version_id']] = true;
            $key = substr(hash('sha256', self::fold($l['description']) . '|' . self::fold($l['brand_model']) . '|' . self::fold($l['unit_label'])), 0, 16);
            $entry = ['quote_folio' => $l['quote_folio'], 'version_number' => $l['version_number'] === null ? null : (int) $l['version_number'],
                'quote_date' => $l['quote_date'] ?? substr((string) $l['quote_created_at'], 0, 10), 'quote_version_id' => $l['quote_version_id'],
                'requisition_folio' => $l['requisition_folio'], 'requisition_id' => $l['requisition_id'],
                'quantity' => self::num($l['quantity']), 'unit_price' => self::num($l['unit_price']), 'currency' => $l['currency_code'],
                'cost' => self::num($l['cost_amount']), 'original_cost' => self::num($l['original_cost_amount']), 'original_cost_currency' => $l['original_cost_currency'],
                'supplier' => $l['supplier']];
            if (! isset($articles[$key])) {
                // Lines arrive newest first: the first occurrence is the latest price/cost/supplier.
                $articles[$key] = ['key' => $key, 'description' => (string) $l['description'], 'brand_model' => $l['brand_model'] ?: null,
                    'unit' => $l['unit_label'] ?: null, 'category' => $l['category'] ?: null, 'occurrences' => 0, 'last' => $entry, 'history' => []];
            }
            $a = &$articles[$key];
            $a['occurrences']++;
            if ($a['category'] === null && $l['category']) {
                $a['category'] = $l['category'];
            }
            if (count($a['history']) < 5) {
                $a['history'][] = $entry;
            }
            unset($a);
        }
        return [
            'client' => ['id' => $c['public_id'], 'code' => $c['code'], 'name' => $c['legal_name'], 'status' => $c['status_code'],
                'project' => $c['default_project_reference'], 'contract' => $c['default_contract_reference'],
                'policy' => ['sales_policy' => $c['repeat_sales_policy'], 'sourcing_policy' => $c['repeat_sourcing_policy'],
                    'price_validity_days' => $c['repeat_price_validity_days'] === null ? null : (int) $c['repeat_price_validity_days'],
                    'contract_reference' => $c['repeat_contract_reference'], 'contract_valid_until' => $c['repeat_contract_valid_until'],
                    'min_margin_pct' => self::num($c['repeat_min_margin_pct']), 'updated_at' => $c['repeat_policy_updated_at']]],
            'items' => array_values($articles),
            'totals' => ['approved_quotes' => count($versions), 'lines' => count($lines), 'articles' => count($articles)],
            'approval_rule' => 'Cotizaciones al cliente aprobadas (estado heredado "Aprobada", decisión del cliente aprobada o decisión registrada); excluye versiones sustituidas.',
            'read_only' => true,
        ];
    }
}
