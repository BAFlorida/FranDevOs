-- EverSmith development cohort. Sized 2026-08-29; see cohort_sizes figure.
CREATE OR REPLACE VIEW es04_usl_veterans_field AS
SELECT 'usl_veterans_field' AS cohort_id, record_id,
       'military service anywhere in history + field-service brand owner' AS matched_on,
       'solid' AS confidence
FROM (SELECT p.record_id FROM persons p WHERE p.brand_segment IN ('lawn_pest_outdoor','trades_mechanical','facilities_b2b_services','restoration_cleaning','industrial_services')
  AND EXISTS (SELECT 1 FROM roles r WHERE r.record_id=p.record_id AND r.is_military_org));
