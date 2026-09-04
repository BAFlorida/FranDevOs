-- EverSmith development cohort. Sized 2026-08-29; see cohort_sizes figure.
CREATE OR REPLACE VIEW es03_usl_field_unit_mgmt AS
SELECT 'usl_field_unit_mgmt' AS cohort_id, record_id,
       'GM/operations background (3y+) who bought a field-service brand' AS matched_on,
       'solid' AS confidence
FROM (SELECT p.record_id FROM persons p WHERE p.brand_segment IN ('lawn_pest_outdoor','trades_mechanical','facilities_b2b_services','restoration_cleaning','industrial_services')
  AND EXISTS (SELECT 1 FROM backgrounds b WHERE b.record_id=p.record_id
              AND b.function IN ('general_management','operations') AND b.tier>=2));
