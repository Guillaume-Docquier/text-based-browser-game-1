insert into "ships" (game_id, id, type, owner_player_id, planet_id)
SELECT roster.game_id, 'T-' || lpad(roster.ship_number::text, 2, '0'), 'TRANSPORT', roster.player_id, home.id
FROM (
  SELECT players.game_id, players.player_id, row_number() OVER (PARTITION BY players.game_id ORDER BY players.player_id) AS ship_number
  FROM players
  JOIN games ON games.id = players.game_id
  WHERE games.started_at IS NOT NULL
) AS roster
JOIN LATERAL (
  SELECT planets.id FROM planets
  WHERE planets.game_id = roster.game_id AND planets.owner_player_id = roster.player_id
  ORDER BY planets.id
  LIMIT 1
) AS home ON true
WHERE NOT EXISTS (
  SELECT 1 FROM ships
  WHERE ships.game_id = roster.game_id AND ships.owner_player_id = roster.player_id AND ships.type = 'TRANSPORT'
)
ON CONFLICT (game_id, id) DO NOTHING;
