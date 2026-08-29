-- EverSmith development cohort. Sized 2026-08-29; see cohort_sizes figure.
CREATE OR REPLACE VIEW es02_usl_green_conversions AS
SELECT 'usl_green_conversions' AS cohort_id, record_id,
       'prior green-industry business ownership before any franchise' AS matched_on,
       'thin_high_signal' AS confidence
FROM (SELECT DISTINCT p.record_id FROM persons p JOIN roles r USING(record_id)
  WHERE p.career_path IN ('owner_straight_to_franchise','owner_then_corporate')
    AND NOT r.is_franchise_role AND r.is_ownership
    AND r.start_ym IS NOT NULL AND r.start_ym < p.fr_start_ym
    AND regexp_matches(r.company_norm || ' ' || r.title_norm,
        '\b(landscap\w*|lawn|grounds|irrigation|tree (service|care)|mowing|outdoor|nursery|turf)\b'));
