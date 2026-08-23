SET SESSION sql_mode = '';

-- Sorting by date listed is a full table scan + filesort without this.
CREATE INDEX idx_listing_date ON rets_property (ListingContractDate);

-- Open house lookups by date range (the calendar).
CREATE INDEX idx_oh_date ON rets_openhouse (OpenHouseDate);