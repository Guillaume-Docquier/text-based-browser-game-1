CREATE FUNCTION notify_turn_state_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('turn_state_changed', NEW.game_id::text);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER turn_state_on_turn_insert
AFTER INSERT ON turns
FOR EACH ROW EXECUTE FUNCTION notify_turn_state_change();
--> statement-breakpoint
CREATE TRIGGER turn_state_on_turn_update
AFTER UPDATE OF status, ends_at ON turns
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.ends_at IS DISTINCT FROM NEW.ends_at)
EXECUTE FUNCTION notify_turn_state_change();
--> statement-breakpoint
CREATE TRIGGER turn_state_on_readiness_update
AFTER UPDATE OF is_ready ON players
FOR EACH ROW
WHEN (OLD.is_ready IS DISTINCT FROM NEW.is_ready)
EXECUTE FUNCTION notify_turn_state_change();
