-- The headline career-path partition over the usable population, with the
-- returner profile the flat file could not express.
SELECT
    career_path,
    count(*) AS people,
    round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct,
    round(median(n_pre_roles), 1) AS median_pre_roles,
    round(median(yrs_between), 1) AS median_yrs_own_exit_to_franchise,
    round(median(n_corp_after), 1) AS median_corp_roles_between
FROM persons
GROUP BY career_path
ORDER BY people DESC;
