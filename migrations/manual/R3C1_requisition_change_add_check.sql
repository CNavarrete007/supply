-- SupplyFlow INT02-HF2 isolated rehearsal only. NOT for live execution.
-- The original schema has TWO checks on requisition_change_items:
--   ck_reqchangeitems_target: target_kind IN ('item','header')
--   ck_reqchangeitems_resolution: header/item ownership and nullable item rules.
-- R3C1 originally replaced the FIRST check, leaving the SECOND check to reject
-- all new item proposals with requisition_item_id IS NULL. Fix the restrictive
-- check instead; do not weaken target_kind or disable FK/CHECK enforcement.
-- A production migration requires a separate review, backup and authorization.
-- Verify exact original CHECK before applying in any environment.
ALTER TABLE `requisition_change_items`
    DROP CONSTRAINT ck_reqchangeitems_resolution,
    ADD CONSTRAINT ck_reqchangeitems_resolution CHECK (
        (target_kind='header' AND requisition_item_id IS NULL AND field_code IS NOT NULL)
        OR (target_kind='item' AND (
            requisition_item_id IS NOT NULL
            OR resolution_status='legacy_unresolved'
            OR (requisition_item_id IS NULL AND change_kind='add'
                AND snapshot_schema_version=2
                AND resolution_status IN ('proposed','applied','rejected'))
        ))
    );
