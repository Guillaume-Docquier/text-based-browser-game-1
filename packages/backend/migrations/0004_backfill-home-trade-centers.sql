INSERT INTO buildings (game_id, type, planet_id, site)
SELECT center.game_id, 'TRADE_CENTER', center.planet_id, free.site
FROM buildings AS center
JOIN planets AS planet ON planet.game_id = center.game_id AND planet.id = center.planet_id
CROSS JOIN LATERAL (
  SELECT site
  FROM generate_series(0, planet.area - 1) AS candidate(site)
  WHERE NOT EXISTS (
    SELECT 1 FROM buildings AS occupied
    WHERE occupied.game_id = planet.game_id AND occupied.planet_id = planet.id AND occupied.site = candidate.site
  )
  ORDER BY site
  LIMIT 1
) AS free
WHERE center.type = 'COMMAND_CENTER' AND planet.owner_player_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM buildings AS trade
    WHERE trade.game_id = planet.game_id AND trade.planet_id = planet.id AND trade.type = 'TRADE_CENTER'
  )
ON CONFLICT (game_id, planet_id, site) DO NOTHING;
