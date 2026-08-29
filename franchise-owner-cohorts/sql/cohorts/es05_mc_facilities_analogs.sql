-- EverSmith development cohort. Sized 2026-08-29; see cohort_sizes figure.
CREATE OR REPLACE VIEW es05_mc_facilities_analogs AS
SELECT 'mc_facilities_analogs' AS cohort_id, record_id,
       'current owner in facilities-B2B or industrial services segment' AS matched_on,
       'solid_analog_seed' AS confidence
FROM (SELECT p.record_id FROM persons p WHERE p.brand_segment IN ('facilities_b2b_services','industrial_services'));
