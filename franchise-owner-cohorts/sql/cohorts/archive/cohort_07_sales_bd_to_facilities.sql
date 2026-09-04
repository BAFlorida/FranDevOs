-- Sales / business-development directors+ -> facilities & B2B franchises,
-- 2020s buyers. Weak lift, decent volume.
CREATE OR REPLACE VIEW cohort_07_sales_bd_to_facilities AS
SELECT
    'sales_bd_to_facilities' AS cohort_id,
    p.record_id,
    'pre-franchise sales/BD director+ title + facilities/industrial brand + 2020s start' AS matched_on,
    'weak_lift' AS confidence
FROM persons p
WHERE p.brand_segment IN ('facilities_b2b_services', 'industrial_services')
  AND p.fr_start_ym >= (SELECT value FROM vocab_constants WHERE key = 'recent_start_ym_min')
  AND EXISTS (
      SELECT 1 FROM roles r
      WHERE r.record_id = p.record_id
        AND NOT r.is_franchise_role
        AND r.start_ym IS NOT NULL AND r.start_ym < p.fr_start_ym
        AND r.is_sales_bd_leader
  );
