-- EverSmith development cohort. Sized 2026-08-29; see cohort_sizes figure.
CREATE OR REPLACE VIEW es10_es_second_attempt_field AS
SELECT 'es_second_attempt_field' AS cohort_id, record_id,
       'owner -> corporate -> franchise path, field-service brand' AS matched_on,
       'solid' AS confidence
FROM (SELECT p.record_id FROM persons p WHERE p.career_path='owner_then_corporate'
  AND p.brand_segment IN ('lawn_pest_outdoor','trades_mechanical','facilities_b2b_services','restoration_cleaning','industrial_services'));
