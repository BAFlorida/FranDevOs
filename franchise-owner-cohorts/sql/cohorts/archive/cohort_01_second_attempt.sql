-- Owner -> corporate -> franchise ("second attempt").
-- Evidence: strong — distinct path; see persons.yrs_between / n_corp_after.
CREATE OR REPLACE VIEW cohort_01_second_attempt AS
SELECT
    'second_attempt' AS cohort_id,
    record_id,
    'career_path = owner_then_corporate' AS matched_on,
    'strong' AS confidence
FROM persons
WHERE career_path = 'owner_then_corporate';
