CREATE FUNCTION notify_turn_state_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('turn_state_changed', NEW.game_id::text);
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER inserted_turn_state
AFTER INSERT ON turns
FOR EACH ROW EXECUTE FUNCTION notify_turn_state_changed();
--> statement-breakpoint
CREATE TRIGGER updated_turn_state
AFTER UPDATE ON turns
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.ends_at IS DISTINCT FROM NEW.ends_at)
EXECUTE FUNCTION notify_turn_state_changed();
--> statement-breakpoint
CREATE TRIGGER updated_player_readiness
AFTER UPDATE ON players
FOR EACH ROW WHEN (OLD.is_ready IS DISTINCT FROM NEW.is_ready)
EXECUTE FUNCTION notify_turn_state_changed();
