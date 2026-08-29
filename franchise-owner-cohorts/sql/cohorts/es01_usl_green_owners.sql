-- EverSmith development cohort. Sized 2026-08-29; see cohort_sizes figure.
CREATE OR REPLACE VIEW es01_usl_green_owners AS
SELECT 'usl_green_owners' AS cohort_id, record_id,
       'current owner in lawn/pest/outdoor segment' AS matched_on,
       'strong_analog_seed' AS confidence
FROM (SELECT p.record_id FROM persons p WHERE p.brand_segment='lawn_pest_outdoor');
