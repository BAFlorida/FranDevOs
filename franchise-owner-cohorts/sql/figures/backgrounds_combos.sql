-- Which backgrounds travel together (both at 3y+), vs independence.
WITH base AS (SELECT count(*) AS n FROM persons),
t AS (SELECT record_id, function FROM backgrounds WHERE tier >= 2),
tot AS (SELECT function, count(*) AS n FROM t GROUP BY 1)
SELECT
    a.function AS f1, b.function AS f2, count(*) AS people_both,
    round(100.0 * count(*) / base.n, 1) AS pct_of_everyone,
    round((1.0 * count(*) / base.n) / ((1.0 * ta.n / base.n) * (1.0 * tb.n / base.n)), 2) AS lift_vs_independent
FROM t a
JOIN t b ON a.record_id = b.record_id AND a.function < b.function
JOIN tot ta ON ta.function = a.function
JOIN tot tb ON tb.function = b.function
CROSS JOIN base
GROUP BY a.function, b.function, ta.n, tb.n, base.n
HAVING count(*) >= 40
ORDER BY people_both DESC
LIMIT 25;
