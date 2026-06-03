CREATE TABLE "star_system_generation_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planet_density_numeric_type" varchar(16) NOT NULL,
	"planet_density_max_bound_type" varchar(16) NOT NULL,
	"planet_density_min" double precision NOT NULL,
	"planet_density_max" double precision NOT NULL,
	"nb_planets_numeric_type" varchar(16) NOT NULL,
	"nb_planets_max_bound_type" varchar(16) NOT NULL,
	"nb_planets_min" double precision NOT NULL,
	"nb_planets_max" double precision NOT NULL,
	"nb_moons_per_planet_numeric_type" varchar(16) NOT NULL,
	"nb_moons_per_planet_max_bound_type" varchar(16) NOT NULL,
	"nb_moons_per_planet_min" double precision NOT NULL,
	"nb_moons_per_planet_max" double precision NOT NULL,
	"nb_asteroid_belts_numeric_type" varchar(16) NOT NULL,
	"nb_asteroid_belts_max_bound_type" varchar(16) NOT NULL,
	"nb_asteroid_belts_min" double precision NOT NULL,
	"nb_asteroid_belts_max" double precision NOT NULL,
	"nb_asteroids_per_sector_numeric_type" varchar(16) NOT NULL,
	"nb_asteroids_per_sector_max_bound_type" varchar(16) NOT NULL,
	"nb_asteroids_per_sector_min" double precision NOT NULL,
	"nb_asteroids_per_sector_max" double precision NOT NULL,
	"seed" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "star_system_generation_settings_planet_density_numeric_type_check" CHECK ("star_system_generation_settings"."planet_density_numeric_type" in ('float', 'integer')),
	CONSTRAINT "star_system_generation_settings_planet_density_max_bound_type_check" CHECK ("star_system_generation_settings"."planet_density_max_bound_type" in ('inclusive', 'exclusive')),
	CONSTRAINT "star_system_generation_settings_planet_density_range_order_check" CHECK (("star_system_generation_settings"."planet_density_max_bound_type" = 'inclusive' and "star_system_generation_settings"."planet_density_min" <= "star_system_generation_settings"."planet_density_max") or ("star_system_generation_settings"."planet_density_max_bound_type" = 'exclusive' and "star_system_generation_settings"."planet_density_min" < "star_system_generation_settings"."planet_density_max")),
	CONSTRAINT "star_system_generation_settings_nb_planets_numeric_type_check" CHECK ("star_system_generation_settings"."nb_planets_numeric_type" in ('float', 'integer')),
	CONSTRAINT "star_system_generation_settings_nb_planets_max_bound_type_check" CHECK ("star_system_generation_settings"."nb_planets_max_bound_type" in ('inclusive', 'exclusive')),
	CONSTRAINT "star_system_generation_settings_nb_planets_range_order_check" CHECK (("star_system_generation_settings"."nb_planets_max_bound_type" = 'inclusive' and "star_system_generation_settings"."nb_planets_min" <= "star_system_generation_settings"."nb_planets_max") or ("star_system_generation_settings"."nb_planets_max_bound_type" = 'exclusive' and "star_system_generation_settings"."nb_planets_min" < "star_system_generation_settings"."nb_planets_max")),
	CONSTRAINT "star_system_generation_settings_nb_moons_per_planet_numeric_type_check" CHECK ("star_system_generation_settings"."nb_moons_per_planet_numeric_type" in ('float', 'integer')),
	CONSTRAINT "star_system_generation_settings_nb_moons_per_planet_max_bound_type_check" CHECK ("star_system_generation_settings"."nb_moons_per_planet_max_bound_type" in ('inclusive', 'exclusive')),
	CONSTRAINT "star_system_generation_settings_nb_moons_per_planet_range_order_check" CHECK (("star_system_generation_settings"."nb_moons_per_planet_max_bound_type" = 'inclusive' and "star_system_generation_settings"."nb_moons_per_planet_min" <= "star_system_generation_settings"."nb_moons_per_planet_max") or ("star_system_generation_settings"."nb_moons_per_planet_max_bound_type" = 'exclusive' and "star_system_generation_settings"."nb_moons_per_planet_min" < "star_system_generation_settings"."nb_moons_per_planet_max")),
	CONSTRAINT "star_system_generation_settings_nb_asteroid_belts_numeric_type_check" CHECK ("star_system_generation_settings"."nb_asteroid_belts_numeric_type" in ('float', 'integer')),
	CONSTRAINT "star_system_generation_settings_nb_asteroid_belts_max_bound_type_check" CHECK ("star_system_generation_settings"."nb_asteroid_belts_max_bound_type" in ('inclusive', 'exclusive')),
	CONSTRAINT "star_system_generation_settings_nb_asteroid_belts_range_order_check" CHECK (("star_system_generation_settings"."nb_asteroid_belts_max_bound_type" = 'inclusive' and "star_system_generation_settings"."nb_asteroid_belts_min" <= "star_system_generation_settings"."nb_asteroid_belts_max") or ("star_system_generation_settings"."nb_asteroid_belts_max_bound_type" = 'exclusive' and "star_system_generation_settings"."nb_asteroid_belts_min" < "star_system_generation_settings"."nb_asteroid_belts_max")),
	CONSTRAINT "star_system_generation_settings_nb_asteroids_per_sector_numeric_type_check" CHECK ("star_system_generation_settings"."nb_asteroids_per_sector_numeric_type" in ('float', 'integer')),
	CONSTRAINT "star_system_generation_settings_nb_asteroids_per_sector_max_bound_type_check" CHECK ("star_system_generation_settings"."nb_asteroids_per_sector_max_bound_type" in ('inclusive', 'exclusive')),
	CONSTRAINT "star_system_generation_settings_nb_asteroids_per_sector_range_order_check" CHECK (("star_system_generation_settings"."nb_asteroids_per_sector_max_bound_type" = 'inclusive' and "star_system_generation_settings"."nb_asteroids_per_sector_min" <= "star_system_generation_settings"."nb_asteroids_per_sector_max") or ("star_system_generation_settings"."nb_asteroids_per_sector_max_bound_type" = 'exclusive' and "star_system_generation_settings"."nb_asteroids_per_sector_min" < "star_system_generation_settings"."nb_asteroids_per_sector_max"))
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "star_system_generation_settings_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "star_systems" ADD COLUMN "generation_settings_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_star_system_generation_settings_id_star_system_generation_settings_id_fk" FOREIGN KEY ("star_system_generation_settings_id") REFERENCES "public"."star_system_generation_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_systems" ADD CONSTRAINT "star_systems_generation_settings_id_star_system_generation_settings_id_fk" FOREIGN KEY ("generation_settings_id") REFERENCES "public"."star_system_generation_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_systems" DROP COLUMN "generation_settings";