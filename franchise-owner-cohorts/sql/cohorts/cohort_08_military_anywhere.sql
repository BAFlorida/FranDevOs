-- Military service ANYWHERE in the career history — the cohort the flat file
-- structurally hid (it could only see the last role before ownership).
-- Matched on employer, so National Guard + reserve components count.
CREATE OR REPLACE VIEW cohort_08_military_anywhere AS
SELECT
    'military_anywhere' AS cohort_id,
    p.record_id,
    'military organization appears in any career role' AS matched_on,
    'recounted_role_level' AS confidence
FROM persons p
WHERE EXISTS (
    SELECT 1 FROM roles r
    WHERE r.record_id = p.record_id
      AND r.is_military_org
);
