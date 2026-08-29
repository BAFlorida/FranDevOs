-- EverSmith development cohort. Sized 2026-08-29; see cohort_sizes figure.
CREATE OR REPLACE VIEW es06_mc_b2b_sales_careers AS
SELECT 'mc_b2b_sales_careers' AS cohort_id, record_id,
       'career-tier sales background who bought a B2B services brand' AS matched_on,
       'solid' AS confidence
FROM (SELECT p.record_id FROM persons p
  WHERE p.brand_segment IN ('facilities_b2b_services','industrial_services','shipping_print_signage')
    AND EXISTS (SELECT 1 FROM backgrounds b WHERE b.record_id=p.record_id
                AND b.function='sales' AND b.tier=3));
