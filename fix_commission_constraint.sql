-- Make commission_rate nullable so we don't need to provide it anymore
ALTER TABLE services ALTER COLUMN commission_rate DROP NOT NULL;
ALTER TABLE services ALTER COLUMN commission_rate SET DEFAULT 0;
