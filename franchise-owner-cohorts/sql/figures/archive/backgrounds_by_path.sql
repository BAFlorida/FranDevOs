-- Background mix by career path: are second-attempt owners different animals?
WITH pathn AS (SELECT career_path, count(*) AS n FROM persons GROUP BY 1),
overall AS (
    SELECT function, count(*) AS n FROM backgrounds WHERE tier >= 2 GROUP BY 1
),
bp AS (
    SELECT p.career_path, b.function, count(*) AS n
    FROM backgrounds b JOIN persons p USING (record_id)
    WHERE b.tier >= 2
    GROUP BY 1, 2
)
SELECT
    bp.career_path, bp.function, bp.n,
    round(100.0 * bp.n / pathn.n, 1) AS pct_of_path,
    round(100.0 * overall.n / (SELECT count(*) FROM persons), 1) AS pct_overall,
    round((1.0 * bp.n / pathn.n) / (1.0 * overall.n / (SELECT count(*) FROM persons)), 2) AS lift
FROM bp
JOIN pathn USING (career_path)
JOIN overall ON overall.function = bp.function
WHERE bp.n >= 15
ORDER BY bp.career_path, lift DESC;
