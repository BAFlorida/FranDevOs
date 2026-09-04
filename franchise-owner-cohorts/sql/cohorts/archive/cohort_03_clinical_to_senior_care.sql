-- Nurse / clinical background -> senior-care franchise, 2020s buyers.
-- Strong lift, thin volume: prioritize for testing, do not quote as fact.
CREATE OR REPLACE VIEW cohort_03_clinical_to_senior_care AS
SELECT
    'clinical_to_senior_care' AS cohort_id,
    p.record_id,
    'pre-franchise clinical title + senior-care brand + 2020s start' AS matched_on,
    'strong_lift_thin_volume' AS confidence
FROM persons p
WHERE p.brand_segment = 'senior_care_healthcare'
  AND p.fr_start_ym >= (SELECT value FROM vocab_constants WHERE key = 'recent_start_ym_min')
  AND EXISTS (
      SELECT 1 FROM roles r
      WHERE r.record_id = p.record_id
        AND NOT r.is_franchise_role
        AND r.start_ym IS NOT NULL AND r.start_ym < p.fr_start_ym
        AND r.is_clinical_title
  );
