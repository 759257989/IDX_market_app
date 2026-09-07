-- CREATE INDEX revalidates every column in the table, not just the ones being
-- indexed. This feed's active_check column is a
-- `timestamp NOT NULL DEFAULT '0000-00-00 00:00:00'`, which the default
-- NO_ZERO_DATE mode rejects -- so index creation fails on a column no index
-- here even touches. Relaxing the mode for this session only is the fix.
SET SESSION sql_mode = '';

-- Numeric filters (range/equality) each get a plain index.
CREATE INDEX idx_price ON rets_property (L_SystemPrice);
CREATE INDEX idx_beds  ON rets_property (L_Keyword2);
CREATE INDEX idx_baths ON rets_property (LM_Dec_3);
CREATE INDEX idx_zip   ON rets_property (L_Zip);

-- Composite functional index. The first part matches the exact
-- LOWER(TRIM(L_City)) expression the city filter uses, which a plain index on
-- L_City cannot serve as a lookup. The second part carries price so the common
-- "city plus price range" filter is answered by this one index.
CREATE INDEX idx_city_price
  ON rets_property ((LOWER(TRIM(L_City))), L_SystemPrice);
