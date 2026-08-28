-- Regional / multi-site managers -> automotive franchise, 2020s buyers.
-- Thin; may not survive contact with the audit.
CREATE OR REPLACE VIEW cohort_10_multisite_to_automotive AS
SELECT
    'multisite_to_automotive' AS cohort_id,
    p.record_id,
    'pre-franchise multi-site management title + automotive brand + 2020s start' AS matched_on,
    'thin' AS confidence
FROM persons p
WHERE p.brand_segment = 'automotive'
  AND p.fr_start_ym >= (SELECT value FROM vocab_constants WHERE key = 'recent_start_ym_min')
  AND EXISTS (
      SELECT 1 FROM roles r
      WHERE r.record_id = p.record_id
        AND NOT r.is_franchise_role
        AND r.start_ym IS NOT NULL AND r.start_ym < p.fr_start_ym
        AND r.is_multisite_mgr
  );
