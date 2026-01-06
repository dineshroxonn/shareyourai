-- ShareYourAI: Claude Code Sharing Platform
-- Migration: Add marketplace tables

-- Add credit_balance to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(10,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connect_id TEXT;

/**
* CLAUDE_ACCOUNTS
* Stores lender's encrypted Claude OAuth tokens
*/
CREATE TABLE claude_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  encrypted_tokens TEXT NOT NULL,
  token_nonce TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  subscription_type TEXT, -- 'max_5x' | 'max_20x'
  rate_limit_tier TEXT,
  is_valid BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE claude_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own claude accounts" ON claude_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own claude accounts" ON claude_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own claude accounts" ON claude_accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own claude accounts" ON claude_accounts
  FOR DELETE USING (auth.uid() = user_id);

/**
* LISTINGS
* Marketplace listings for Claude access
*/
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  claude_account_id UUID REFERENCES claude_accounts(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price_per_1m_tokens DECIMAL(10,4) NOT NULL DEFAULT 3.00,
  max_concurrent INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  total_tokens_served BIGINT DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  rating_avg DECIMAL(3,2),
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active listings" ON listings
  FOR SELECT USING (is_active = true);
CREATE POLICY "Lenders can view own listings" ON listings
  FOR SELECT USING (auth.uid() = lender_id);
CREATE POLICY "Lenders can insert own listings" ON listings
  FOR INSERT WITH CHECK (auth.uid() = lender_id);
CREATE POLICY "Lenders can update own listings" ON listings
  FOR UPDATE USING (auth.uid() = lender_id);
CREATE POLICY "Lenders can delete own listings" ON listings
  FOR DELETE USING (auth.uid() = lender_id);

/**
* PROXY_KEYS
* Borrower's access keys to use listings
*/
CREATE TABLE proxy_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE proxy_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Borrowers can view own proxy keys" ON proxy_keys
  FOR SELECT USING (auth.uid() = borrower_id);
CREATE POLICY "Borrowers can insert proxy keys" ON proxy_keys
  FOR INSERT WITH CHECK (auth.uid() = borrower_id);
CREATE POLICY "Borrowers can delete own proxy keys" ON proxy_keys
  FOR DELETE USING (auth.uid() = borrower_id);

/**
* USAGE_LOGS
* Per-request tracking for billing
*/
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proxy_key_id UUID REFERENCES proxy_keys(id) ON DELETE SET NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  borrower_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage (as borrower)" ON usage_logs
  FOR SELECT USING (auth.uid() = borrower_id);
CREATE POLICY "Users can view own usage (as lender)" ON usage_logs
  FOR SELECT USING (auth.uid() = lender_id);

-- Index for faster queries
CREATE INDEX idx_usage_logs_borrower ON usage_logs(borrower_id, created_at DESC);
CREATE INDEX idx_usage_logs_lender ON usage_logs(lender_id, created_at DESC);
CREATE INDEX idx_usage_logs_listing ON usage_logs(listing_id, created_at DESC);

/**
* TRANSACTIONS
* All money movements
*/
CREATE TYPE transaction_type AS ENUM ('deposit', 'usage', 'payout', 'refund', 'earning');

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type transaction_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  stripe_ref TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_transactions_user ON transactions(user_id, created_at DESC);

/**
* REVIEWS
* Borrower reviews of listings
*/
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  borrower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, borrower_id) -- One review per borrower per listing
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Borrowers can insert own reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = borrower_id);
CREATE POLICY "Borrowers can update own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = borrower_id);

-- Function to update listing rating when review is added/updated
CREATE OR REPLACE FUNCTION update_listing_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE listings
  SET
    rating_avg = (SELECT AVG(rating)::DECIMAL(3,2) FROM reviews WHERE listing_id = NEW.listing_id),
    rating_count = (SELECT COUNT(*) FROM reviews WHERE listing_id = NEW.listing_id)
  WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_listing_rating
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_listing_rating();

-- Add realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE listings;
ALTER PUBLICATION supabase_realtime ADD TABLE usage_logs;
