-- Is the two-month median gap between prior-role end and franchise start an
-- artifact of prior-role selection? The pipeline's rule 1 picks the pre-franchise
-- role with the LATEST explicit end at/before the franchise start — i.e. the
-- nearest role by construction. Compare that against the population of ALL dated
-- pre-franchise role endings, and split cohort 9 by how it qualifies.
WITH pre AS (
    SELECT r.record_id, r.start_ym, r.end_ym, r.end_is_present, r.duration_mo,
           p.fr_start_ym
    FROM roles r JOIN persons p USING (record_id)
    WHERE NOT r.is_franchise_role
      AND r.start_ym IS NOT NULL
      AND r.start_ym < p.fr_start_ym
),
ended AS (SELECT * FROM pre WHERE end_ym IS NOT NULL),
nearest AS (  -- what selection rule 1 sees: the latest-ending role per person
    SELECT record_id, fr_start_ym - max(end_ym) AS gap_mo
    FROM ended GROUP BY record_id, fr_start_ym
),
last_pre AS (  -- cohort 9's base: last pre-franchise role by start
    SELECT *, row_number() OVER (PARTITION BY record_id ORDER BY start_ym DESC) AS rn
    FROM pre
),
c9 AS (
    SELECT *,
           coalesce(duration_mo, fr_start_ym - start_ym) AS tenure_mo,
           (end_ym IS NULL AND end_is_present) AS via_stale_present
    FROM last_pre
    WHERE rn = 1
      AND coalesce(duration_mo, fr_start_ym - start_ym) >= 36
      AND ((end_ym IS NULL AND end_is_present) OR end_ym >= fr_start_ym - 3)
)
SELECT 'persons with >=1 dated-ended pre-franchise role' AS metric,
       count(*)::VARCHAR AS value FROM nearest
UNION ALL SELECT 'median gap, NEAREST role only (what the flat file measured), months',
       median(gap_mo)::VARCHAR FROM nearest
UNION ALL SELECT 'median gap, ALL dated role endings, months',
       median(fr_start_ym - end_ym)::VARCHAR FROM ended
UNION ALL SELECT 'p25 / p75 gap across all endings, months',
       round(quantile_cont(fr_start_ym - end_ym, 0.25),1)::VARCHAR || ' / ' ||
       round(quantile_cont(fr_start_ym - end_ym, 0.75),1)::VARCHAR FROM ended
UNION ALL SELECT 'share of nearest-role gaps <= 3 months',
       round(100.0 * count(*) FILTER (WHERE gap_mo <= 3) / count(*), 1)::VARCHAR || '%' FROM nearest
UNION ALL SELECT 'cohort 9 size (current definition)',
       count(*)::VARCHAR FROM c9
UNION ALL SELECT 'cohort 9 qualifying via stale/true Present end (unverifiable)',
       count(*) FILTER (WHERE via_stale_present)::VARCHAR FROM c9
UNION ALL SELECT 'cohort 9 qualifying via explicit end within 3 months (verifiable)',
       count(*) FILTER (WHERE NOT via_stale_present)::VARCHAR FROM c9
UNION ALL SELECT 'cohort 9 median tenure of qualifying role, months',
       median(tenure_mo)::VARCHAR FROM c9;
