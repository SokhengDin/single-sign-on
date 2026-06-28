ALTER TABLE client ADD COLUMN IF NOT EXISTS provider TEXT;

UPDATE client SET provider = 'telegram' WHERE client_id = 'telegram-bot';
