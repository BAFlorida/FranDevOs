-- Owner -> straight to franchise (serial operator / conversion).
CREATE OR REPLACE VIEW cohort_02_serial_operator AS
SELECT
    'serial_operator' AS cohort_id,
    record_id,
    'career_path = owner_straight_to_franchise' AS matched_on,
    'strong' AS confidence
FROM persons
WHERE career_path = 'owner_straight_to_franchise';
