-- EverSmith development cohort. Sized 2026-08-29; see cohort_sizes figure.
CREATE OR REPLACE VIEW es07_mc_facilities_pros AS
SELECT 'mc_facilities_pros' AS cohort_id, record_id,
       'pre-franchise facilities/janitorial/building-services role, any brand bought' AS matched_on,
       'thin_high_signal' AS confidence
FROM (SELECT DISTINCT p.record_id FROM persons p JOIN roles r USING(record_id)
  WHERE NOT r.is_franchise_role AND r.start_ym IS NOT NULL AND r.start_ym < p.fr_start_ym
    AND regexp_matches(r.title_norm || ' ' || r.company_norm,
        '\b(facilit\w*|janitorial|custodial|building (services|maintenance)|property manager|building engineer)\b'));
