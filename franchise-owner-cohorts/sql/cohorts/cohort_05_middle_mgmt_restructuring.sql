-- Corporate middle management (manager/director band, not VP+) with a stint at
-- a restructuring-heavy employer. High volume, low lift. SIZE IS VOCAB-DEPENDENT:
-- the employer list in config/vocab.yaml is a starter set — edit it, rebuild,
-- and this cohort re-sizes. Not restricted to recent buyers.
CREATE OR REPLACE VIEW cohort_05_middle_mgmt_restructuring AS
SELECT
    'middle_mgmt_restructuring' AS cohort_id,
    p.record_id,
    'pre-franchise middle-management title at restructuring-list employer' AS matched_on,
    'volume_low_lift' AS confidence
FROM persons p
WHERE EXISTS (
    SELECT 1 FROM roles r
    WHERE r.record_id = p.record_id
      AND NOT r.is_franchise_role
      AND r.start_ym IS NOT NULL AND r.start_ym < p.fr_start_ym
      AND r.is_middle_mgmt
      AND r.at_restructuring_employer
);
