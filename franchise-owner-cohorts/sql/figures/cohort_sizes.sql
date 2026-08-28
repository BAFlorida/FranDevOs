-- Canonical cohort sizes with their evidence grade, plus 2020s-buyer counts.
SELECT
    c.cohort_id,
    any_value(c.confidence) AS confidence,
    count(*) AS people,
    count(*) FILTER (
        WHERE p.fr_start_ym >= (SELECT value FROM vocab_constants WHERE key='recent_start_ym_min')
    ) AS people_2020s,
    round(100.0 * count(*) / (SELECT count(*) FROM persons), 1) AS pct_of_usable
FROM cohorts c
JOIN persons p USING (record_id)
GROUP BY c.cohort_id
ORDER BY people DESC;
