-- Numeric filters (range/equality) each get a plain index.
CREATE INDEX idx_price ON rets_property (L_SystemPrice);
CREATE INDEX idx_beds  ON rets_property (L_Keyword2);
CREATE INDEX idx_baths ON rets_property (LM_Dec_3);
CREATE INDEX idx_zip   ON rets_property (L_Zip);
CREATE INDEX idx_city_price
  ON rets_property ((LOWER(TRIM(L_City))), L_SystemPrice);