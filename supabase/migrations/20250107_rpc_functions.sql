-- RPC functions for credit operations (called by proxy server)

-- Deduct credits from a user
CREATE OR REPLACE FUNCTION deduct_credits(user_id UUID, amount DECIMAL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET credit_balance = credit_balance - amount
  WHERE id = user_id AND credit_balance >= amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient credits or user not found';
  END IF;
END;
$$;

-- Add credits to a user
CREATE OR REPLACE FUNCTION add_credits(user_id UUID, amount DECIMAL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET credit_balance = credit_balance + amount
  WHERE id = user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

-- Increment listing stats
CREATE OR REPLACE FUNCTION increment_listing_stats(listing_id UUID, tokens BIGINT, earnings DECIMAL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE listings
  SET
    total_tokens_served = total_tokens_served + tokens,
    total_earnings = total_earnings + earnings
  WHERE id = listing_id;
END;
$$;

-- Update account last used timestamp
CREATE OR REPLACE FUNCTION update_account_last_used(account_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE claude_accounts
  SET last_used_at = NOW()
  WHERE id = account_id;
END;
$$;
