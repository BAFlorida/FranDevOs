-- Phase-one cohort 2 of 3 (purchase-act): bought a facilities-B2B or
-- industrial-services franchise — primary brand today, or a prior franchise
-- ownership role at a brand in those segments. Owners only; no date required.
CREATE OR REPLACE VIEW facilities_owners AS
SELECT 'facilities_owners' AS cohort_id, p.record_id,
       CASE WHEN p.brand_segment IN ('facilities_b2b_services', 'industrial_services')
            THEN 'primary brand in facilities_b2b_services / industrial_services'
            ELSE 'prior franchise ownership role in facilities_b2b_services / industrial_services' END AS matched_on,
       'purchase_act' AS confidence
FROM persons p
WHERE p.population = 'owner' AND p.screen_status = 'approved_candidate'
  AND (p.brand_segment IN ('facilities_b2b_services', 'industrial_services')
       OR EXISTS (SELECT 1 FROM roles r
                  WHERE r.record_id = p.record_id
                    AND r.franchise_brand_segment IN ('facilities_b2b_services', 'industrial_services')
                    AND (r.is_ownership OR r.is_franchise_role)));
