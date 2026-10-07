-- Retain the initial exhibit and every subsequent content revision.
INSERT OR IGNORE INTO settlement_revisions(plot_id,revision,content,saved_at)
SELECT id,revision,content,updated_at FROM plots;
CREATE TRIGGER plots_initial_revision AFTER INSERT ON plots BEGIN
  INSERT INTO settlement_revisions(plot_id,revision,content,saved_at)
  VALUES (NEW.id,NEW.revision,NEW.content,NEW.updated_at);
END;
CREATE TRIGGER plots_saved_revision AFTER UPDATE OF revision ON plots BEGIN
  INSERT INTO settlement_revisions(plot_id,revision,content,saved_at)
  VALUES (NEW.id,NEW.revision,NEW.content,NEW.updated_at);
END;
