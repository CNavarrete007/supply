<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use RuntimeException;

/**
 * Campana de notificaciones (solo lectura, cuenta API con SELECT): notificaciones de flujo cuyo destinatario es el usuario en
 * sesión, con el remitente y el documento ligado (tipo, id público y folio) para abrir su módulo. Marcar como leída es una
 * escritura (UPDATE notifications.is_read/read_at) que requiere un permiso todavía no autorizado: aquí no se escribe nada.
 */
final class NotificationReadRepository
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
            throw new RuntimeException('NOTIFICATIONS_QUERY_FAILED');
        }
        return $result->getResultArray();
    }

    /** @param array{status:string,page:int,page_size:int} $f */
    public function mine(int $org, int $user, array $f): array
    {
        $where = 'n.organization_id=? AND n.recipient_user_id=?';
        $binds = [$org, $user];
        $counts = $this->rows("SELECT COUNT(*) AS total,COALESCE(SUM(n.is_read=0),0) AS unread FROM notifications n WHERE {$where}", $binds)[0] ?? [];
        if ($f['status'] === 'unread') {
            $where .= ' AND n.is_read=0';
        }
        $filtered = (int) ($this->rows("SELECT COUNT(*) AS n FROM notifications n WHERE {$where}", $binds)[0]['n'] ?? 0);
        $size = $f['page_size'];
        $on = static fn (string $t, string $a) => " LEFT JOIN {$t} {$a} ON {$a}.id=n.entity_id AND {$a}.organization_id=n.organization_id";
        $items = $this->rows(
            'SELECT n.public_id AS id,n.notification_type AS type,n.title,n.message,n.created_at,n.is_read,n.read_at,sp.display_name AS sender_name,
                    e.entity_kind,e.public_id AS entity_id,
                    COALESCE(po.folio,r.folio,v.folio,f.folio,sq.folio,gr.folio,d.folio,i.folio,so.folio,cr.folio,rv.folio,c.legal_name,s.legal_name) AS entity_folio
             FROM notifications n
             LEFT JOIN users su ON su.id=n.sender_user_id AND su.organization_id=n.organization_id
             LEFT JOIN people sp ON sp.id=su.person_id AND sp.organization_id=su.organization_id
             LEFT JOIN business_entities e ON e.id=n.entity_id AND e.organization_id=n.organization_id'
            . $on('purchase_orders', 'po') . $on('requisitions', 'r') . $on('customer_quote_versions', 'v') . $on('rfqs', 'f') . $on('supplier_quotes', 'sq')
            . $on('goods_receipts', 'gr') . $on('deliveries', 'd') . $on('invoices', 'i') . $on('service_orders', 'so') . $on('requisition_change_requests', 'cr')
            . $on('requisition_reviews', 'rv') . $on('clients', 'c') . $on('suppliers', 's')
            . " WHERE {$where} ORDER BY n.created_at DESC,n.id DESC LIMIT {$size} OFFSET " . (($f['page'] - 1) * $size),
            $binds
        );
        $out = array_map(static fn ($x) => [
            'id' => $x['id'], 'type' => $x['type'], 'title' => $x['title'], 'message' => $x['message'], 'created_at' => $x['created_at'],
            'is_read' => (bool) $x['is_read'], 'read_at' => $x['read_at'], 'sender_name' => $x['sender_name'],
            'entity' => $x['entity_kind'] === null ? null : ['kind' => $x['entity_kind'], 'id' => $x['entity_id'], 'folio' => $x['entity_folio']],
        ], $items);
        return ['items' => $out, 'total' => $filtered, 'page' => $f['page'], 'page_size' => $size,
            'summary' => ['total' => (int) ($counts['total'] ?? 0), 'unread' => (int) ($counts['unread'] ?? 0)],
            'read_only' => true, 'mark_read_enabled' => false];
    }
}
