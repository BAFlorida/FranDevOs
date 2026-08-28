-- Military service anywhere in career history — the role-level recount.
-- (The flat file's last-role-only view reported 1.7%; a narrow-vocab role scan
-- reported ~175. This is the canonical figure with the full branch vocabulary.)
SELECT
    count(DISTINCT p.record_id) AS veterans,
    round(100.0 * count(DISTINCT p.record_id) / (SELECT count(*) FROM persons), 1) AS pct_of_usable,
    count(DISTINCT p.record_id) FILTER (
        WHERE p.fr_start_ym >= (SELECT value FROM vocab_constants WHERE key='recent_start_ym_min')
    ) AS veterans_2020s_buyers
FROM persons p
WHERE EXISTS (SELECT 1 FROM roles r WHERE r.record_id = p.record_id AND r.is_military_org);
