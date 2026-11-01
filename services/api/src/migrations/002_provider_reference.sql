CREATE INDEX IF NOT EXISTS transactions_provider_reference_idx
  ON transactions (provider_reference)
  WHERE provider_reference IS NOT NULL;
