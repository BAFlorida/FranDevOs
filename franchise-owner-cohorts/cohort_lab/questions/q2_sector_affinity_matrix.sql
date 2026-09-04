-- title: Sector affinity matrix
-- Pre-purchase sector (any pre-purchase role tagged with the sector) against
-- the segment of the brand the person bought. lift = P(bought segment | had a
-- role in sector) / P(bought segment) among usable owners. Both sides of the
-- ratio are owners, so this answers "given someone buys, where does this
-- background go?" — not whether the background buys franchises at all.
-- Roles whose sector is unclassified (most of them) are excluded from the
-- sector axis; the segment base rate uses every usable owner with a segment.
WITH base AS (
    SELECT record_id, brand_segment FROM persons
    WHERE population = 'owner' AND is_usable AND brand_segment <> ''
),
tot AS (SELECT count(*) AS n FROM base),
seg AS (SELECT brand_segment, count(*) AS n FROM base GROUP BY 1),
ps AS (
    SELECT DISTINCT r.record_id, r.sector_tag
    FROM roles r JOIN base USING (record_id)
    WHERE r.is_pre_purchase AND r.sector_tag <> 'unclassified'
),
sec AS (SELECT sector_tag, count(*) AS n FROM ps GROUP BY 1),
cell AS (
    SELECT ps.sector_tag, b.brand_segment, count(*) AS n
    FROM ps JOIN base b USING (record_id) GROUP BY 1, 2
)
SELECT c.sector_tag AS pre_purchase_sector, c.brand_segment AS purchased_segment,
       c.n AS people, sec.n AS sector_people,
       round(100.0 * c.n / sec.n, 1) AS pct_of_sector,
       round(100.0 * seg.n / tot.n, 1) AS pct_of_everyone,
       round((1.0 * c.n / sec.n) / (1.0 * seg.n / tot.n), 2) AS lift
FROM cell c
JOIN sec USING (sector_tag)
JOIN seg USING (brand_segment)
CROSS JOIN tot
ORDER BY pre_purchase_sector, lift DESC;
