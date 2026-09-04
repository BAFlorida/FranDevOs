-- Phase-one cohort 1 of 3 (purchase-act): bought a lawn / pest / outdoor
-- franchise — either their primary brand today, or a prior franchise
-- ownership role at a brand in that segment. Owners only; no date required
-- (a seed list does not need a dated purchase).
CREATE OR REPLACE VIEW green_owners AS
SELECT 'green_owners' AS cohort_id, p.record_id,
       CASE WHEN p.brand_segment = 'lawn_pest_outdoor' THEN 'primary brand in lawn_pest_outdoor'
            ELSE 'prior franchise ownership role in lawn_pest_outdoor' END AS matched_on,
       'purchase_act' AS confidence
FROM persons p
WHERE p.population = 'owner' AND p.screen_status = 'approved_candidate'
  AND (p.brand_segment = 'lawn_pest_outdoor'
       OR EXISTS (SELECT 1 FROM roles r
                  WHERE r.record_id = p.record_id
                    AND r.franchise_brand_segment = 'lawn_pest_outdoor'
                    AND (r.is_ownership OR r.is_franchise_role)));
