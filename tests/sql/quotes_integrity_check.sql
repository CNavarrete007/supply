-- Cotizaciones y Comparativo · verificación de integridad de lo REGISTRADO POR SUPPLYFLOW (solo lectura: únicamente SELECT).
-- Revisa las RFQ (tarjetas 2-3), las cotizaciones de proveedor (tarjeta 4) y los borradores de cotización al cliente (tarjeta 6)
-- creados en SupplyFlow; no toca los expedientes importados del sistema original (imported_at / legacy_id).
-- Uso: phpMyAdmin → base supplyflow_dev → pestaña SQL → pegar y Continuar. Resultado: una fila por verificación con el número
-- de anomalías; TODAS deben ser 0. No modifica nada.
-- (Sandbox: bash $S/sqlq.sh < tests/sql/quotes_integrity_check.sql)
WITH
sf_rfq AS (SELECT f.* FROM rfqs f JOIN business_entities e ON e.id = f.id AND e.organization_id = f.organization_id
           WHERE e.imported_at IS NULL AND e.legacy_id IS NULL AND f.folio REGEXP '^RFQ-[0-9]{4}-[0-9]{4,}$'),
sf_sq AS (SELECT q.*, e.public_id FROM supplier_quotes q JOIN business_entities e ON e.id = q.id AND e.organization_id = q.organization_id
          WHERE e.imported_at IS NULL AND e.legacy_id IS NULL AND q.folio REGEXP '^COT-[0-9]{4}-[0-9]{4,}$' AND q.rfq_id IS NOT NULL),
sf_cq AS (SELECT v.*, e.public_id, cq.series_reference FROM customer_quote_versions v JOIN customer_quotes cq ON cq.id = v.customer_quote_id AND cq.organization_id = v.organization_id
          JOIN business_entities e ON e.id = v.id AND e.organization_id = v.organization_id
          WHERE cq.series_reference LIKE 'sf:%' AND e.imported_at IS NULL AND e.legacy_id IS NULL)
SELECT '00 · RFQ registradas en SupplyFlow (informativo)' AS verificacion, (SELECT COUNT(*) FROM sf_rfq) AS anomalias
UNION ALL SELECT '00 · Cotizaciones de proveedor registradas en SupplyFlow (informativo)', (SELECT COUNT(*) FROM sf_sq)
UNION ALL SELECT '00 · Borradores de cotización al cliente de SupplyFlow (informativo)', (SELECT COUNT(*) FROM sf_cq)
-- Tarjetas 2-3 · RFQ
UNION ALL SELECT '01 · RFQ: folio duplicado', (SELECT COUNT(*) FROM (SELECT 1 FROM sf_rfq GROUP BY organization_id, folio HAVING COUNT(*) > 1) d)
UNION ALL SELECT '02 · RFQ: sin partidas', (SELECT COUNT(*) FROM sf_rfq f WHERE NOT EXISTS (SELECT 1 FROM rfq_items i WHERE i.organization_id = f.organization_id AND i.rfq_id = f.id))
UNION ALL SELECT '03 · RFQ: estatus distinto de Borrador/Enviada', (SELECT COUNT(*) FROM sf_rfq WHERE status_code NOT IN ('borrador', 'enviada') OR legacy_status NOT IN ('Borrador', 'Enviada'))
UNION ALL SELECT '04 · RFQ: partida de otra requisición o no vigente', (SELECT COUNT(*) FROM sf_rfq f JOIN rfq_items i ON i.organization_id = f.organization_id AND i.rfq_id = f.id
          LEFT JOIN requisition_items r ON r.id = i.requisition_item_id AND r.organization_id = i.organization_id
          WHERE i.requisition_id <> f.requisition_id OR r.id IS NULL OR r.requisition_id <> f.requisition_id)
UNION ALL SELECT '05 · RFQ: sin evento rfq.recorded en la requisición', (SELECT COUNT(*) FROM sf_rfq f JOIN business_entities e ON e.id = f.id AND e.organization_id = f.organization_id
          WHERE NOT EXISTS (SELECT 1 FROM workflow_events w WHERE w.organization_id = f.organization_id AND w.entity_id = f.requisition_id AND w.action_code = 'rfq.recorded'
          AND JSON_VALUE(w.payload_json, '$.rfq') = e.public_id))
UNION ALL SELECT '06 · RFQ: sin bitácora rfq.create', (SELECT COUNT(*) FROM sf_rfq f WHERE NOT EXISTS (SELECT 1 FROM audit_events a WHERE a.organization_id = f.organization_id
          AND a.subject_entity_id = f.id AND a.module_code = 'quotes' AND a.action_code = 'rfq.create'))
UNION ALL SELECT '07 · RFQ enviada sin bitácora rfq.mark_sent ni alta como Enviada', (SELECT COUNT(*) FROM sf_rfq f WHERE f.status_code = 'enviada' AND NOT EXISTS (SELECT 1 FROM audit_events a
          WHERE a.organization_id = f.organization_id AND a.subject_entity_id = f.id AND a.module_code = 'quotes'
          AND (a.action_code = 'rfq.mark_sent' OR (a.action_code = 'rfq.create' AND JSON_VALUE(a.changes_json, '$.after.status') IN ('enviada', 'sent', 'Enviada')))))
-- Tarjeta 4 · cotización del proveedor
UNION ALL SELECT '10 · Cot. proveedor: folio duplicado', (SELECT COUNT(*) FROM (SELECT 1 FROM sf_sq GROUP BY organization_id, folio HAVING COUNT(*) > 1) d)
UNION ALL SELECT '11 · Cot. proveedor: más de una por RFQ', (SELECT COUNT(*) FROM (SELECT 1 FROM supplier_quotes q WHERE q.rfq_id IN (SELECT rfq_id FROM sf_sq) GROUP BY q.organization_id, q.rfq_id HAVING COUNT(*) > 1) d)
UNION ALL SELECT '12 · Cot. proveedor: su RFQ está en borrador o cancelada (misma regla del servidor)', (SELECT COUNT(*) FROM sf_sq q JOIN rfqs f ON f.id = q.rfq_id AND f.organization_id = q.organization_id
          WHERE LOWER(f.status_code) IN ('borrador', 'draft', 'cancelada', 'cancelled', 'canceled', 'anulada') OR LOWER(TRIM(COALESCE(f.legacy_status, ''))) IN ('borrador', 'draft', 'cancelada', 'cancelled', 'canceled', 'anulada'))
UNION ALL SELECT '13 · Cot. proveedor: requisición distinta a la de su RFQ', (SELECT COUNT(*) FROM sf_sq q JOIN rfqs f ON f.id = q.rfq_id AND f.organization_id = q.organization_id WHERE f.requisition_id <> q.requisition_id)
UNION ALL SELECT '14 · Cot. proveedor: importe de partida ≠ cantidad × precio', (SELECT COUNT(*) FROM sf_sq q JOIN supplier_quote_items i ON i.organization_id = q.organization_id AND i.supplier_quote_id = q.id
          WHERE i.offered = 1 AND ABS(i.line_subtotal - ROUND(i.quantity * i.unit_price, 2)) > 0.005)
UNION ALL SELECT '15 · Cot. proveedor: partida no ofertada con importe', (SELECT COUNT(*) FROM sf_sq q JOIN supplier_quote_items i ON i.organization_id = q.organization_id AND i.supplier_quote_id = q.id
          WHERE i.offered = 0 AND COALESCE(i.line_subtotal, 0) <> 0)
UNION ALL SELECT '16 · Cot. proveedor: subtotal ≠ suma de partidas ofertadas', (SELECT COUNT(*) FROM sf_sq q WHERE ABS(q.subtotal_amount - (SELECT COALESCE(SUM(i.line_subtotal), 0)
          FROM supplier_quote_items i WHERE i.organization_id = q.organization_id AND i.supplier_quote_id = q.id AND i.offered = 1)) > 0.005)
UNION ALL SELECT '17 · Cot. proveedor: total ≠ subtotal + IVA', (SELECT COUNT(*) FROM sf_sq WHERE ABS(total_amount - (subtotal_amount + tax_amount)) > 0.005)
UNION ALL SELECT '18 · Cot. proveedor: estatus distinto de Recibida', (SELECT COUNT(*) FROM sf_sq WHERE legacy_status <> 'Recibida')
UNION ALL SELECT '19 · Cot. proveedor: sin evento quote.recorded / bitácora supplier_quote.create', (SELECT COUNT(*) FROM sf_sq q WHERE NOT EXISTS (SELECT 1 FROM workflow_events w
          WHERE w.organization_id = q.organization_id AND w.entity_id = q.requisition_id AND w.action_code = 'quote.recorded' AND JSON_VALUE(w.payload_json, '$.quote') = q.public_id)
          OR NOT EXISTS (SELECT 1 FROM audit_events a WHERE a.organization_id = q.organization_id AND a.subject_entity_id = q.id AND a.module_code = 'quotes' AND a.action_code = 'supplier_quote.create'))
-- Tarjeta 6 · borrador de cotización al cliente
UNION ALL SELECT '20 · Cot. cliente: folio duplicado en la serie de SupplyFlow', (SELECT COUNT(*) FROM (SELECT 1 FROM sf_cq GROUP BY organization_id, folio HAVING COUNT(*) > 1) d)
UNION ALL SELECT '21 · Cot. cliente: serie ≠ sf:<folio de la Rev. 0>', (SELECT COUNT(*) FROM sf_cq WHERE version_number = 1 AND series_reference <> CONCAT('sf:', folio))
UNION ALL SELECT '22 · Cot. cliente: la requisición tiene además otra cotización al cliente', (SELECT COUNT(*) FROM sf_cq v WHERE EXISTS (SELECT 1 FROM customer_quotes o
          WHERE o.organization_id = v.organization_id AND o.requisition_id = v.requisition_id AND o.id <> v.customer_quote_id))
UNION ALL SELECT '23 · Cot. cliente: ya no es borrador interno (estatus/aprobación/decisión/emisión)', (SELECT COUNT(*) FROM sf_cq WHERE document_status <> 'draft'
          OR internal_approval_status <> 'not_requested' OR client_decision_status <> 'not_recorded' OR legacy_status <> 'Borrador' OR issued_at IS NOT NULL OR locked_at IS NOT NULL)
UNION ALL SELECT '24 · Cot. cliente: sin partidas', (SELECT COUNT(*) FROM sf_cq v WHERE NOT EXISTS (SELECT 1 FROM customer_quote_items i WHERE i.organization_id = v.organization_id AND i.customer_quote_version_id = v.id))
UNION ALL SELECT '25 · Cot. cliente: importe de partida ≠ cantidad × precio de venta', (SELECT COUNT(*) FROM sf_cq v JOIN customer_quote_items i ON i.organization_id = v.organization_id
          AND i.customer_quote_version_id = v.id WHERE ABS(i.line_subtotal - ROUND(i.quantity * i.unit_price, 2)) > 0.005)
UNION ALL SELECT '26 · Cot. cliente: subtotal de terceros ≠ suma de partidas', (SELECT COUNT(*) FROM sf_cq v WHERE ABS(v.subtotal_amount - (SELECT COALESCE(SUM(i.line_subtotal), 0)
          FROM customer_quote_items i WHERE i.organization_id = v.organization_id AND i.customer_quote_version_id = v.id)) > 0.005)
UNION ALL SELECT '27 · Cot. cliente: base gravable ≠ subtotal − descuento', (SELECT COUNT(*) FROM sf_cq WHERE ABS(third_party_taxable_amount - (subtotal_amount - discount_amount)) > 0.005)
UNION ALL SELECT '28 · Cot. cliente: total terceros ≠ base + IVA', (SELECT COUNT(*) FROM sf_cq WHERE ABS(third_party_total_amount - (third_party_taxable_amount + third_party_tax_amount)) > 0.005)
UNION ALL SELECT '29 · Cot. cliente: Service Fee total ≠ importe + IVA (o con importe sin aplicar)', (SELECT COUNT(*) FROM sf_cq WHERE ABS(service_fee_total_amount - (service_fee_subtotal_amount + service_fee_tax_amount)) > 0.005
          OR (service_fee_enabled = 0 AND service_fee_total_amount <> 0))
UNION ALL SELECT '30 · Cot. cliente: total ≠ terceros + Service Fee; IVA ≠ IVA terceros + IVA Service Fee', (SELECT COUNT(*) FROM sf_cq WHERE ABS(total_amount - (third_party_total_amount + service_fee_total_amount)) > 0.005
          OR ABS(tax_amount - (third_party_tax_amount + service_fee_tax_amount)) > 0.005)
UNION ALL SELECT '31 · Cot. cliente: partida de otra requisición', (SELECT COUNT(*) FROM sf_cq v JOIN customer_quote_items i ON i.organization_id = v.organization_id AND i.customer_quote_version_id = v.id
          LEFT JOIN requisition_items r ON r.id = i.requisition_item_id AND r.organization_id = i.organization_id WHERE r.id IS NULL OR r.requisition_id <> v.requisition_id)
UNION ALL SELECT '32 · Cot. cliente: sin evento cq.draft_saved / bitácora customer_quote.draft_create', (SELECT COUNT(*) FROM sf_cq v WHERE v.version_number = 1 AND (NOT EXISTS (SELECT 1 FROM workflow_events w
          WHERE w.organization_id = v.organization_id AND w.entity_id = v.requisition_id AND w.action_code = 'cq.draft_saved' AND JSON_VALUE(w.payload_json, '$.customer_quote') = v.public_id)
          OR NOT EXISTS (SELECT 1 FROM audit_events a WHERE a.organization_id = v.organization_id AND a.subject_entity_id = v.id AND a.module_code = 'quotes' AND a.action_code = 'customer_quote.draft_create')))
-- Idempotencia y control de versión
UNION ALL SELECT '40 · Claves de idempotencia de Cotizaciones sin completar (> 1 h)', (SELECT COUNT(*) FROM idempotency_keys k WHERE k.endpoint_code LIKE '%quote%'
          AND k.state_code NOT IN ('completed', 'succeeded', 'done') AND k.created_at < UTC_TIMESTAMP() - INTERVAL 1 HOUR)
UNION ALL SELECT '41 · Registros de Cotizaciones con versión < 1', (SELECT COUNT(*) FROM business_entities e WHERE e.row_version < 1 AND e.id IN (SELECT id FROM sf_rfq UNION SELECT id FROM sf_sq UNION SELECT id FROM sf_cq))
UNION ALL SELECT '42 · Adjudicaciones creadas por SupplyFlow (la tarjeta 10 sigue bloqueada: debe ser 0)', (SELECT COUNT(*) FROM awards aw JOIN business_entities e ON e.id = aw.id AND e.organization_id = aw.organization_id
          WHERE e.imported_at IS NULL AND e.legacy_id IS NULL AND aw.supplier_quote_id IN (SELECT id FROM sf_sq));
