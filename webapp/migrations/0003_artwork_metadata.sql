-- Future artwork authoring stays deferred. Store dimensions, collision, and
-- directional layout with the immutable artwork revision, not each placement.
ALTER TABLE custom_asset_revisions ADD COLUMN pixel_width INTEGER NOT NULL DEFAULT 8 CHECK(pixel_width IN (8,16));
ALTER TABLE custom_asset_revisions ADD COLUMN pixel_height INTEGER NOT NULL DEFAULT 8 CHECK(pixel_height IN (8,16));
ALTER TABLE custom_asset_revisions ADD COLUMN footprint_tiles INTEGER NOT NULL DEFAULT 1 CHECK(footprint_tiles IN (1,2));
ALTER TABLE custom_asset_revisions ADD COLUMN solid INTEGER NOT NULL DEFAULT 0 CHECK(solid IN (0,1));
ALTER TABLE custom_asset_revisions ADD COLUMN frame_layout TEXT NOT NULL DEFAULT 'single' CHECK(frame_layout IN ('single','directional-2-step'));
