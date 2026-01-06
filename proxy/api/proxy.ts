import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';

// Lazy initialization
let supabase: SupabaseClient | null = null;
let ENCRYPTION_KEY: Uint8Array | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

function getEncryptionKey(): Uint8Array {
  if (!ENCRYPTION_KEY) {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('Missing ENCRYPTION_KEY');
    }
    ENCRYPTION_KEY = naclUtil.decodeBase64(process.env.ENCRYPTION_KEY);
  }
  return ENCRYPTION_KEY;
}

interface ProxyKeyData {
  id: string;
  borrower_id: string;
  listing_id: string;
  key_hash: string;
  is_active: boolean;
  listings: {
    id: string;
    account_id: string;
    price_per_1m_tokens: number;
    is_active: boolean;
    lender_id: string;
    claude_accounts: {
      id: string;
      encrypted_access_token: string;
      access_token_nonce: string;
      encrypted_refresh_token: string;
      refresh_token_nonce: string;
      token_expires_at: string;
      is_active: boolean;
    };
  };
}

interface BorrowerData {
  credit_balance: number;
}

// Decrypt a token using NaCl secretbox
function decryptToken(encrypted: string, nonce: string): string {
  const encryptedBytes = naclUtil.decodeBase64(encrypted);
  const nonceBytes = naclUtil.decodeBase64(nonce);
  const decrypted = nacl.secretbox.open(encryptedBytes, nonceBytes, getEncryptionKey());

  if (!decrypted) {
    throw new Error('Failed to decrypt token');
  }

  return new TextDecoder().decode(decrypted);
}

// Validate proxy key and return associated data
async function validateProxyKey(proxyKey: string): Promise<{
  proxyKeyData: ProxyKeyData;
  borrower: BorrowerData;
  accessToken: string;
} | null> {
  const keyPrefix = proxyKey.substring(0, 16);

  const { data: proxyKeys, error } = await getSupabase()
    .from('proxy_keys')
    .select(`
      id,
      borrower_id,
      listing_id,
      key_hash,
      is_active,
      listings (
        id,
        account_id,
        price_per_1m_tokens,
        is_active,
        lender_id,
        claude_accounts (
          id,
          encrypted_access_token,
          access_token_nonce,
          encrypted_refresh_token,
          refresh_token_nonce,
          token_expires_at,
          is_active
        )
      )
    `)
    .eq('key_prefix', keyPrefix)
    .eq('is_active', true);

  if (error || !proxyKeys || proxyKeys.length === 0) {
    return null;
  }

  for (const pk of proxyKeys) {
    const isValid = await bcrypt.compare(proxyKey, pk.key_hash);
    if (isValid) {
      const proxyKeyData = pk as unknown as ProxyKeyData;

      if (!proxyKeyData.listings?.is_active || !proxyKeyData.listings?.claude_accounts?.is_active) {
        return null;
      }

      const { data: borrower, error: borrowerError } = await getSupabase()
        .from('users')
        .select('credit_balance')
        .eq('id', proxyKeyData.borrower_id)
        .single();

      if (borrowerError || !borrower) {
        return null;
      }

      const accessToken = decryptToken(
        proxyKeyData.listings.claude_accounts.encrypted_access_token,
        proxyKeyData.listings.claude_accounts.access_token_nonce
      );

      return {
        proxyKeyData,
        borrower,
        accessToken,
      };
    }
  }

  return null;
}

// Log usage and update balances
async function logUsage(
  proxyKeyId: string,
  listingId: string,
  borrowerId: string,
  lenderId: string,
  tokensUsed: number,
  pricePerMillion: number
): Promise<void> {
  const cost = (tokensUsed / 1_000_000) * pricePerMillion;
  const platformFee = cost * 0.15;
  const lenderEarnings = cost - platformFee;

  const db = getSupabase();

  await db.rpc('deduct_credits', {
    user_id: borrowerId,
    amount: cost,
  });

  await db.rpc('add_credits', {
    user_id: lenderId,
    amount: lenderEarnings,
  });

  await db.from('usage_logs').insert({
    proxy_key_id: proxyKeyId,
    listing_id: listingId,
    tokens_used: tokensUsed,
    cost,
    endpoint: '/v1/messages',
  });

  await db.rpc('increment_listing_stats', {
    listing_id: listingId,
    tokens: tokensUsed,
    earnings: lenderEarnings,
  });
}

function extractAuthToken(req: VercelRequest): string | null {
  const authHeader = req.headers['authorization'] || req.headers['x-api-key'];

  if (!authHeader) {
    return null;
  }

  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (header.startsWith('Bearer ')) {
    return header.substring(7);
  }

  return header;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Handle health check
    if (req.url === '/health') {
      return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');
      return res.status(200).end();
    }

    const proxyKey = extractAuthToken(req);

    if (!proxyKey || !proxyKey.startsWith('sk-proxy-')) {
      return res.status(401).json({
        error: {
          type: 'authentication_error',
          message: 'Invalid or missing proxy key',
        },
      });
    }

    const validation = await validateProxyKey(proxyKey);

    if (!validation) {
      return res.status(401).json({
        error: {
          type: 'authentication_error',
          message: 'Invalid proxy key or access revoked',
        },
      });
    }

    const { proxyKeyData, borrower, accessToken } = validation;

    if (borrower.credit_balance < 0.01) {
      return res.status(402).json({
        error: {
          type: 'payment_required',
          message: 'Insufficient credits. Please add credits at shareyourai.com',
        },
      });
    }

    // Extract the path after /v1/
    const urlPath = req.url?.replace(/^\/api\/proxy/, '') || '';
    const apiPath = urlPath.startsWith('/v1/') ? urlPath.substring(4) : urlPath.replace(/^\//, '');
    const targetUrl = `https://api.anthropic.com/v1/${apiPath}`;

    const response = await fetch(targetUrl, {
      method: req.method as string,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'anthropic-version': (req.headers['anthropic-version'] as string) || '2023-06-01',
        'x-api-key': accessToken,
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const responseData = await response.json();

    if (responseData.usage) {
      const totalTokens = (responseData.usage.input_tokens || 0) + (responseData.usage.output_tokens || 0);

      logUsage(
        proxyKeyData.id,
        proxyKeyData.listing_id,
        proxyKeyData.borrower_id,
        proxyKeyData.listings.lender_id,
        totalTokens,
        proxyKeyData.listings.price_per_1m_tokens
      ).catch(err => console.error('Usage logging failed:', err));
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      error: {
        type: 'internal_error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
    });
  }
}
