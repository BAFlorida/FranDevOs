-- title: Owner pool distributions (for the Clay comparison spec)
-- Metro, state, career length (years since first dated job, 5-year buckets)
-- and dated-role counts across approved owners — the quotas a matched
-- comparison search must reproduce. Metros are the Clay/LinkedIn location
-- strings, lightly cleaned, not geocoded: suburbs stay separate from their
-- core city. pct_of_owners uses every approved owner as the denominator, so
-- blanks show up as the gap to 100%.
WITH o AS (
    SELECT * FROM persons WHERE population = 'owner' AND screen_status = 'approved_candidate'
),
n AS (SELECT count(*) AS n FROM o)
SELECT 'metro' AS dimension, metro AS value, count(*) AS people,
       round(100.0 * count(*) / n.n, 1) AS pct_of_owners
FROM o, n WHERE metro <> '' GROUP BY 1, 2, n.n
UNION ALL
SELECT 'state', state, count(*), round(100.0 * count(*) / n.n, 1)
FROM o, n WHERE state <> '' GROUP BY 1, 2, n.n
UNION ALL
SELECT 'years_since_first_job',
       lpad(CAST(floor(years_since_first_job / 5) * 5 AS INTEGER)::VARCHAR, 2, '0') || '-'
         || lpad(CAST(floor(years_since_first_job / 5) * 5 + 4 AS INTEGER)::VARCHAR, 2, '0'),
       count(*), round(100.0 * count(*) / n.n, 1)
FROM o, n WHERE years_since_first_job IS NOT NULL GROUP BY 1, 2, n.n
UNION ALL
SELECT 'dated_roles', lpad(least(dated_roles, 10)::VARCHAR, 2, '0') || CASE WHEN dated_roles >= 10 THEN '+' ELSE '' END,
       count(*), round(100.0 * count(*) / n.n, 1)
FROM o, n GROUP BY 1, 2, n.n
ORDER BY dimension, people DESC, value;
