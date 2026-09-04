-- title: Purchase year by function tier
-- For each purchase year (usable owners, years with 30+ buyers), the share of
-- that year's buyers with an experienced (3y+) or career tier in each
-- function tag — the era question in one click. Share of owners only: a
-- shift here can be the workforce shifting, not the buyer, until the
-- comparison sample exists.
WITH unp AS (
    SELECT record_id, franchise_purchase_year, replace(function_tag, 'tier_', '') AS function_tag, tier
    FROM (
        UNPIVOT (SELECT record_id, franchise_purchase_year, tier_sales, tier_clinical, tier_finance,
                        tier_technical, tier_gm, tier_ops
                 FROM persons WHERE population = 'owner' AND is_usable)
        ON tier_sales, tier_clinical, tier_finance, tier_technical, tier_gm, tier_ops
        INTO NAME function_tag VALUE tier
    )
),
yr AS (SELECT franchise_purchase_year, count(DISTINCT record_id) AS buyers FROM unp GROUP BY 1)
SELECT u.franchise_purchase_year AS purchase_year, u.function_tag, y.buyers,
       count(*) FILTER (WHERE u.tier >= 2) AS experienced_3y,
       round(100.0 * count(*) FILTER (WHERE u.tier >= 2) / y.buyers, 1) AS pct_experienced_3y,
       count(*) FILTER (WHERE u.tier = 3) AS career,
       round(100.0 * count(*) FILTER (WHERE u.tier = 3) / y.buyers, 1) AS pct_career
FROM unp u JOIN yr y USING (franchise_purchase_year)
WHERE y.buyers >= 30
GROUP BY 1, 2, 3
ORDER BY 1, 2;
