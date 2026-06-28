ALTER TABLE client ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE client ADD COLUMN IF NOT EXISTS external_system TEXT;

UPDATE client SET provider = 'telegram', external_system = 'utility-backend' WHERE client_id = 'telegram-bot';
