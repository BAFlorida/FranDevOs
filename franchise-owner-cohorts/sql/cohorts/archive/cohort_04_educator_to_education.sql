-- Teacher / principal background -> education franchise, 2020s buyers.
-- Education employer required so business-"Principal" titles don't leak in.
CREATE OR REPLACE VIEW cohort_04_educator_to_education AS
SELECT
    'educator_to_education' AS cohort_id,
    p.record_id,
    'pre-franchise educator title at education employer + education brand + 2020s start' AS matched_on,
    'strong_lift_thin_volume' AS confidence
FROM persons p
WHERE p.brand_segment = 'education_childcare'
  AND p.fr_start_ym >= (SELECT value FROM vocab_constants WHERE key = 'recent_start_ym_min')
  AND EXISTS (
      SELECT 1 FROM roles r
      WHERE r.record_id = p.record_id
        AND NOT r.is_franchise_role
        AND r.start_ym IS NOT NULL AND r.start_ym < p.fr_start_ym
        AND r.is_education_title
        AND r.at_education_employer
  );
