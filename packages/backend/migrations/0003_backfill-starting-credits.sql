update "players" AS p
SET credit_balance = 100
FROM games AS g
WHERE p.game_id = g.id AND g.started_at IS NOT NULL AND p.credit_balance IS NULL;
