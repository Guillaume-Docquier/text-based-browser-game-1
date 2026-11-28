INSERT INTO buildings (game_id, type, planet_id, site)
SELECT p.game_id, 'COMMAND_CENTER', p.id, 0
FROM planets AS p
JOIN games AS g ON g.id = p.game_id
WHERE g.started_at IS NOT NULL AND p.owner_player_id IS NOT NULL
ON CONFLICT (game_id, planet_id) WHERE type = 'COMMAND_CENTER' DO NOTHING;
