-- Three-year-tenure, still employed at franchise decision time. UNVALIDATED:
-- the two-month median gap behind this cohort is under recency-bias review
-- (see outputs/analysis/cohort9_recency_bias*). Do not build media against it
-- until that check clears.
-- Definition: the person's LAST dated pre-franchise role (by start) ran >= 36
-- months, and either still shows Present or ended within 3 months of the
-- franchise start. Stale-Present tenure is measured against the franchise start.
CREATE OR REPLACE VIEW cohort_09_three_year_tenure AS
WITH last_pre AS (
    SELECT
        r.*,
        p.fr_start_ym,
        row_number() OVER (PARTITION BY r.record_id ORDER BY r.start_ym DESC, r.orig_idx) AS rn
    FROM roles r
    JOIN persons p USING (record_id)
    WHERE NOT r.is_franchise_role
      AND r.start_ym IS NOT NULL
      AND r.start_ym < p.fr_start_ym
)
SELECT
    'three_year_tenure' AS cohort_id,
    record_id,
    'last pre-franchise role >=36mo and Present/ended within 3mo of franchise start' AS matched_on,
    'unvalidated' AS confidence
FROM last_pre
WHERE rn = 1
  AND coalesce(duration_mo, fr_start_ym - start_ym)
      >= (SELECT value FROM vocab_constants WHERE key = 'tenure_min_months')
  AND (
        (end_ym IS NULL AND end_is_present)
        OR end_ym >= fr_start_ym - (SELECT value FROM vocab_constants WHERE key = 'still_employed_grace_months')
      );
