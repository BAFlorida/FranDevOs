-- Phase-one cohort 3 of 3 (purchase-act): bought a restoration /
-- compliance-cleaning franchise — primary brand today, or a prior franchise
-- ownership role at a brand in that segment. Owners only; no date required.
CREATE OR REPLACE VIEW restoration_owners AS
SELECT 'restoration_owners' AS cohort_id, p.record_id,
       CASE WHEN p.brand_segment = 'restoration_cleaning' THEN 'primary brand in restoration_cleaning'
            ELSE 'prior franchise ownership role in restoration_cleaning' END AS matched_on,
       'purchase_act' AS confidence
FROM persons p
WHERE p.population = 'owner' AND p.screen_status = 'approved_candidate'
  AND (p.brand_segment = 'restoration_cleaning'
       OR EXISTS (SELECT 1 FROM roles r
                  WHERE r.record_id = p.record_id
                    AND r.franchise_brand_segment = 'restoration_cleaning'
                    AND (r.is_ownership OR r.is_franchise_role)));
