-- Is the profile of who buys shifting? Career-tier background share among
-- 2020s buyers vs 2010s buyers, per function.
WITH eras AS (
    SELECT record_id,
           CASE WHEN fr_start_ym >= 24240 THEN '2020s'
                WHEN fr_start_ym >= 24120 THEN '2010s' END AS era
    FROM persons WHERE fr_start_ym >= 24120
),
eran AS (SELECT era, count(*) AS n FROM eras GROUP BY 1)
SELECT
    b.function,
    count(*) FILTER (WHERE e.era = '2010s') AS n_2010s,
    round(100.0 * count(*) FILTER (WHERE e.era = '2010s')
        / (SELECT n FROM eran WHERE era = '2010s'), 1) AS pct_2010s,
    count(*) FILTER (WHERE e.era = '2020s') AS n_2020s,
    round(100.0 * count(*) FILTER (WHERE e.era = '2020s')
        / (SELECT n FROM eran WHERE era = '2020s'), 1) AS pct_2020s,
    round(100.0 * count(*) FILTER (WHERE e.era = '2020s')
        / (SELECT n FROM eran WHERE era = '2020s')
        - 100.0 * count(*) FILTER (WHERE e.era = '2010s')
        / (SELECT n FROM eran WHERE era = '2010s'), 1) AS pts_change
FROM backgrounds b JOIN eras e USING (record_id)
WHERE b.tier = 3
GROUP BY b.function
HAVING count(*) >= 30
ORDER BY pts_change DESC;
