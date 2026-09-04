-- title: Function tier share by population
-- Share of usable people whose composition tier in each function tag reaches
-- 1 (touched), 2 (experienced, 3y+) or 3 (career, 7y+ or majority of the
-- basis), owners vs the matched comparison sample, with lift = owner share /
-- comparison share and a 95% CI on the lift (log-ratio normal approximation).
-- Comparison columns are NULL until a comparison sample is loaded — that is
-- deliberate: empty must be visible, never silently absent. Every share here
-- is "share of owners" (or of the comparison sample); nothing is a finding
-- until the comparison side is populated.
-- Denominators: usable people only (owners: dated purchase and >=1 dated
-- pre-purchase role; comparison: >=1 dated role and not screened as an owner).
WITH pop AS (
    SELECT population, count(*) AS n FROM persons WHERE is_usable GROUP BY 1
),
unp AS (
    SELECT record_id, population, replace(function_tag, 'tier_', '') AS function_tag, tier
    FROM (
        UNPIVOT (SELECT record_id, population, tier_sales, tier_clinical, tier_finance,
                        tier_technical, tier_gm, tier_ops
                 FROM persons WHERE is_usable)
        ON tier_sales, tier_clinical, tier_finance, tier_technical, tier_gm, tier_ops
        INTO NAME function_tag VALUE tier
    )
),
tiers AS (
    SELECT * FROM (VALUES (1, 'touched (any role)'), (2, 'experienced (3y+)'),
                          (3, 'career (7y+ or majority)')) t(tier, tier_label)
),
cells AS (
    SELECT u.function_tag, ti.tier, ti.tier_label, u.population,
           count(*) FILTER (WHERE u.tier >= ti.tier) AS k
    FROM unp u CROSS JOIN tiers ti
    GROUP BY 1, 2, 3, 4
),
wide AS (
    SELECT function_tag, tier, tier_label,
           coalesce(max(k) FILTER (WHERE population = 'owner'), 0) AS owners_k,
           max(k) FILTER (WHERE population = 'comparison') AS comparison_k
    FROM cells GROUP BY 1, 2, 3
),
rates AS (
    SELECT w.*, po.n AS owners_n, pc.n AS comparison_n,
           1.0 * w.owners_k / po.n AS p1,
           1.0 * w.comparison_k / nullif(pc.n, 0) AS p2
    FROM wide w
    LEFT JOIN pop po ON po.population = 'owner'
    LEFT JOIN pop pc ON pc.population = 'comparison'
)
SELECT function_tag, tier, tier_label,
       owners_k AS owners, owners_n, round(100 * p1, 1) AS owners_pct,
       comparison_k AS comparison, comparison_n, round(100 * p2, 1) AS comparison_pct,
       round(p1 / nullif(p2, 0), 2) AS lift,
       round(exp(ln(p1 / nullif(p2, 0)) - 1.96 * sqrt((1 - p1) / nullif(owners_k, 0)
                                                     + (1 - p2) / nullif(comparison_k, 0))), 2) AS lift_ci_low,
       round(exp(ln(p1 / nullif(p2, 0)) + 1.96 * sqrt((1 - p1) / nullif(owners_k, 0)
                                                     + (1 - p2) / nullif(comparison_k, 0))), 2) AS lift_ci_high
FROM rates
ORDER BY function_tag, tier;
