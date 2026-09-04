-- title: Cohort overlap matrix
-- Pairwise overlap of the three phase-one cohorts (diagonal = cohort size;
-- a zero is a real zero), plus how many people sit in exactly one / two /
-- three cohorts. Overlap is a COUNT off the baked cohort booleans on
-- persons, never an estimate; it is the number that decides ad-set
-- exclusions.
WITH ids AS (SELECT DISTINCT cohort_id FROM cohorts),
pairs AS (SELECT a.cohort_id AS cohort_a, b.cohort_id AS cohort_b FROM ids a CROSS JOIN ids b),
ov AS (
    SELECT a.cohort_id AS cohort_a, b.cohort_id AS cohort_b, count(*) AS people
    FROM cohorts a JOIN cohorts b USING (record_id)
    GROUP BY 1, 2
)
SELECT p.cohort_a, p.cohort_b,
       CASE WHEN p.cohort_a = p.cohort_b THEN 'size' ELSE 'overlap' END AS kind,
       coalesce(ov.people, 0) AS people
FROM pairs p LEFT JOIN ov USING (cohort_a, cohort_b)
UNION ALL
SELECT 'any cohort', 'in exactly ' || cohort_count || ' cohort(s)', 'multiplicity', count(*)
FROM persons WHERE cohort_count > 0
GROUP BY cohort_count
ORDER BY kind, cohort_a, cohort_b;
