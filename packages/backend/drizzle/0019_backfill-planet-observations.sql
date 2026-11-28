WITH ship_positions AS (
  SELECT s.game_id, s.owner_player_id,
         COALESCE(p.x, st.x, (r.route->'origin'->>'x')::double precision +
           ((r.route->'destination'->>'x')::double precision - (r.route->'origin'->>'x')::double precision) * step.fraction) AS x,
         COALESCE(p.y, st.y, (r.route->'origin'->>'y')::double precision +
           ((r.route->'destination'->>'y')::double precision - (r.route->'origin'->>'y')::double precision) * step.fraction) AS y
  FROM ships s
  LEFT JOIN planets p ON (p.game_id, p.id) = (s.game_id, s.planet_id)
  LEFT JOIN stars st ON (st.game_id, st.id) = (s.game_id, s.star_id)
  CROSS JOIN LATERAL (SELECT s.trip->'route' AS route) r
  CROSS JOIN LATERAL (SELECT LEAST((r.route->>'distance')::double precision,
    (s.trip->>'completedTurns')::integer * (r.route->>'speed')::double precision) /
    NULLIF((r.route->>'distance')::double precision, 0) AS fraction) step
), sources AS (
  SELECT game_id, owner_player_id AS player_id, x, y, 3.0 AS radius FROM planets WHERE owner_player_id IS NOT NULL
  UNION ALL
  SELECT game_id, owner_player_id, x, y, 1.5 FROM ship_positions
), covered AS (
  SELECT DISTINCT s.game_id, s.player_id, p.id AS planet_id
  FROM sources s JOIN planets p ON p.game_id=s.game_id
  WHERE point(s.x,s.y) <-> point(p.x,p.y) <= s.radius
), current_turn AS (
  SELECT game_id,max(turn) AS turn FROM turns GROUP BY game_id
)
INSERT INTO planet_observations (game_id, player_id, planet_id, observed_turn, facts, buildings)
SELECT c.game_id,c.player_id,p.id,t.turn,
  jsonb_build_object('ownerPlayerId',p.owner_player_id,'biome',p.biome,'size',p.size,'area',p.area,'metalProduction',p.metal_production,'remainingMetalDeposit',p.remaining_metal_deposit),
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',b.id,'type',b.type,'planetId',b.planet_id,'site',b.site) ORDER BY b.site)
     FROM buildings b WHERE (b.game_id,b.planet_id)=(p.game_id,p.id)), '[]'::jsonb)
FROM covered c JOIN planets p ON (p.game_id,p.id)=(c.game_id,c.planet_id)
JOIN current_turn t ON t.game_id=c.game_id
ON CONFLICT (game_id, player_id, planet_id) DO NOTHING;
