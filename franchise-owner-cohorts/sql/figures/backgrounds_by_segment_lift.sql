-- Where each background buys, vs the base rate. lift = P(segment | background
-- 3y+) / P(segment). Cells under 15 people suppressed.
WITH base AS (SELECT count(*) AS n FROM persons),
seg AS (SELECT brand_segment, count(*) AS n FROM persons WHERE brand_segment <> '' GROUP BY 1),
bg AS (
    SELECT b.function, p.brand_segment, count(*) AS n,
           sum(count(*)) OVER (PARTITION BY b.function) AS fn_total
    FROM backgrounds b JOIN persons p USING (record_id)
    WHERE b.tier >= 2 AND p.brand_segment <> ''
    GROUP BY b.function, p.brand_segment
)
SELECT
    bg.function, bg.brand_segment, bg.n,
    round(100.0 * bg.n / bg.fn_total, 1) AS pct_of_background,
    round(100.0 * seg.n / base.n, 1) AS pct_of_everyone,
    round((1.0 * bg.n / bg.fn_total) / (1.0 * seg.n / base.n), 2) AS lift
FROM bg, base
JOIN seg ON seg.brand_segment = bg.brand_segment
WHERE bg.n >= 15
ORDER BY lift DESC
LIMIT 45;
