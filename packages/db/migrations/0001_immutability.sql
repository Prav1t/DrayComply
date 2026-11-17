-- Runs, results, reports, original files, template versions and the audit log can never be changed.
-- They can be deleted only inside a transaction that deletes the whole organization, which sets draycomply.purge.
CREATE FUNCTION dc_block_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('draycomply.purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'rows in % are immutable: % refused', TG_TABLE_NAME, TG_OP USING ERRCODE = 'DC001';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE FUNCTION dc_block_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only: TRUNCATE refused', TG_TABLE_NAME USING ERRCODE = 'DC001';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER uploads_immutable BEFORE UPDATE OR DELETE ON uploads FOR EACH ROW EXECUTE FUNCTION dc_block_change();
--> statement-breakpoint
CREATE TRIGGER mapping_templates_immutable BEFORE UPDATE OR DELETE ON mapping_templates FOR EACH ROW EXECUTE FUNCTION dc_block_change();
--> statement-breakpoint
CREATE TRIGGER runs_immutable BEFORE UPDATE OR DELETE ON runs FOR EACH ROW EXECUTE FUNCTION dc_block_change();
--> statement-breakpoint
CREATE TRIGGER run_results_immutable BEFORE UPDATE OR DELETE ON run_results FOR EACH ROW EXECUTE FUNCTION dc_block_change();
--> statement-breakpoint
CREATE TRIGGER reports_immutable BEFORE UPDATE OR DELETE ON reports FOR EACH ROW EXECUTE FUNCTION dc_block_change();
--> statement-breakpoint
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION dc_block_change();
--> statement-breakpoint
CREATE TRIGGER uploads_no_truncate BEFORE TRUNCATE ON uploads FOR EACH STATEMENT EXECUTE FUNCTION dc_block_truncate();
--> statement-breakpoint
CREATE TRIGGER mapping_templates_no_truncate BEFORE TRUNCATE ON mapping_templates FOR EACH STATEMENT EXECUTE FUNCTION dc_block_truncate();
--> statement-breakpoint
CREATE TRIGGER runs_no_truncate BEFORE TRUNCATE ON runs FOR EACH STATEMENT EXECUTE FUNCTION dc_block_truncate();
--> statement-breakpoint
CREATE TRIGGER run_results_no_truncate BEFORE TRUNCATE ON run_results FOR EACH STATEMENT EXECUTE FUNCTION dc_block_truncate();
--> statement-breakpoint
CREATE TRIGGER reports_no_truncate BEFORE TRUNCATE ON reports FOR EACH STATEMENT EXECUTE FUNCTION dc_block_truncate();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION dc_block_truncate();
