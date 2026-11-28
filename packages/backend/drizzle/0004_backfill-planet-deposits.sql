WITH home_systems AS (
  SELECT DISTINCT game_id, star_id
  FROM planets
  WHERE owner_player_id IS NOT NULL
), rolls AS MATERIALIZED (
  SELECT p.game_id, p.id, p.biome,
    CASE
      WHEN p.star_id = 'sun' OR p.biome = 'GAS' OR h.star_id IS NOT NULL THEN false
      WHEN p.biome = 'METALLIC' THEN random() < 0.75
      ELSE random() < 0.25
    END AS has_deposit
  FROM planets p
  LEFT JOIN home_systems h ON h.game_id = p.game_id AND h.star_id = p.star_id
  WHERE p.metal_production IS NULL OR p.remaining_metal_deposit IS NULL
)
UPDATE planets p
SET metal_production = CASE
      WHEN NOT rolls.has_deposit THEN 0
      WHEN rolls.biome = 'METALLIC' THEN 2 + floor(random() * 3)::integer
      ELSE 1 + floor(random() * 3)::integer
    END,
    remaining_metal_deposit = CASE
      WHEN NOT rolls.has_deposit THEN 0
      WHEN rolls.biome = 'METALLIC' THEN 10 + floor(random() * 11)::integer
      ELSE 5 + floor(random() * 11)::integer
    END
FROM rolls
WHERE rolls.game_id = p.game_id AND rolls.id = p.id;
