-- Operations leadership -> trades/mechanical franchise, 2020s buyers.
CREATE OR REPLACE VIEW cohort_06_ops_leader_to_trades AS
SELECT
    'ops_leader_to_trades' AS cohort_id,
    p.record_id,
    'pre-franchise operations-leadership title + trades brand + 2020s start' AS matched_on,
    'moderate' AS confidence
FROM persons p
WHERE p.brand_segment = 'trades_mechanical'
  AND p.fr_start_ym >= (SELECT value FROM vocab_constants WHERE key = 'recent_start_ym_min')
  AND EXISTS (
      SELECT 1 FROM roles r
      WHERE r.record_id = p.record_id
        AND NOT r.is_franchise_role
        AND r.start_ym IS NOT NULL AND r.start_ym < p.fr_start_ym
        AND r.is_ops_leader
  );
