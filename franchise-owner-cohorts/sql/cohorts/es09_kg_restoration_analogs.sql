-- EverSmith development cohort. Sized 2026-08-29; see cohort_sizes figure.
CREATE OR REPLACE VIEW es09_kg_restoration_analogs AS
SELECT 'kg_restoration_analogs' AS cohort_id, record_id,
       'current owner in restoration/compliance-cleaning segment' AS matched_on,
       'strong_analog_seed' AS confidence
FROM (SELECT p.record_id FROM persons p WHERE p.brand_segment='restoration_cleaning');
