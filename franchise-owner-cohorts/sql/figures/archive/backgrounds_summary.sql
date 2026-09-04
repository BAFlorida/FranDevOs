-- Population background exposure per function: anyone / 3y+ / career-tier,
-- with median months among those exposed.
SELECT
    b.function,
    count(*) AS any_job,
    round(100.0 * count(*) / (SELECT count(*) FROM persons), 1) AS pct_any,
    count(*) FILTER (WHERE b.tier >= 2) AS experienced_3y,
    count(*) FILTER (WHERE b.tier = 3) AS career,
    round(100.0 * count(*) FILTER (WHERE b.tier = 3) / (SELECT count(*) FROM persons), 1) AS pct_career,
    round(median(b.months_pre) / 12.0, 1) AS median_years_among_exposed
FROM backgrounds b
GROUP BY b.function
ORDER BY any_job DESC;
