import Fastify from 'fastify';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import nacl from 'tweetnacl';
import 'dotenv/config';

// Helper to decode base64 (works in both Node.js and browser)
function decodeBase64(base64: string): Uint8Array {
  const buffer = Buffer.from(base64, 'base64');
  return new Uint8Array(buffer);
}

const fastify = Fastify({
  logger: true,
});

// Supabase client with service role for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Encryption key for decrypting stored tokens
const ENCRYPTION_KEY = decodeBase64(process.env.ENCRYPTION_KEY!);

interface ProxyKeyData {
  id: string;
  borrower_id: string;
  listing_id: string;
  key_hash: string;
  is_active: boolean;
  listings: {
    id: string;
    claude_account_id: string;
    price_per_1m_tokens: number;
    is_active: boolean;
    lender_id: string;
    claude_accounts: {
      id: string;
      encrypted_tokens: string;
      token_nonce: string;
      token_expires_at: string;
      is_valid: boolean;
    };
  };
}

interface BorrowerData {
  credit_balance: number;
}

// Decrypt a token using NaCl secretbox
function decryptToken(encrypted: string, nonce: string): string {
  const encryptedBytes = decodeBase64(encrypted);
  const nonceBytes = decodeBase64(nonce);
  const decrypted = nacl.secretbox.open(encryptedBytes, nonceBytes, ENCRYPTION_KEY);

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
  // Find proxy keys that start with this prefix
  const keyPrefix = proxyKey.substring(0, 16);

  const { data: proxyKeys, error } = await supabase
    .from('proxy_keys')
    .select(`
      id,
      borrower_id,
      listing_id,
      key_hash,
      is_active,
      listings (
        id,
        claude_account_id,
        price_per_1m_tokens,
        is_active,
        lender_id,
        claude_accounts (
          id,
          encrypted_tokens,
          token_nonce,
          token_expires_at,
          is_valid
        )
      )
    `)
    .eq('key_prefix', keyPrefix)
    .eq('is_active', true);

  if (error || !proxyKeys || proxyKeys.length === 0) {
    return null;
  }

  // Verify the full key hash
  for (const pk of proxyKeys) {
    const isValid = await bcrypt.compare(proxyKey, pk.key_hash);
    if (isValid) {
      const proxyKeyData = pk as unknown as ProxyKeyData;

      // Check if listing and account are active
      if (!proxyKeyData.listings?.is_active || !proxyKeyData.listings?.claude_accounts?.is_valid) {
        return null;
      }

      // Get borrower's credit balance
      const { data: borrower, error: borrowerError } = await supabase
        .from('users')
        .select('credit_balance')
        .eq('id', proxyKeyData.borrower_id)
        .single();

      if (borrowerError || !borrower) {
        return null;
      }

      // Decrypt the tokens and extract access token
      let decryptedTokenJson: string;
      try {
        decryptedTokenJson = decryptToken(
          proxyKeyData.listings.claude_accounts.encrypted_tokens,
          proxyKeyData.listings.claude_accounts.token_nonce
        );
        fastify.log.info({ decryptedLength: decryptedTokenJson.length }, 'Token decrypted successfully');
      } catch (decryptErr) {
        fastify.log.error({ err: decryptErr }, 'Failed to decrypt token');
        return null;
      }

      const tokenData = JSON.parse(decryptedTokenJson);
      const accessToken = tokenData.claudeAiOauth?.accessToken || tokenData.accessToken;
      fastify.log.info({
        hasClaudeOauth: !!tokenData.claudeAiOauth,
        tokenPrefix: accessToken?.substring(0, 20),
        tokenLength: accessToken?.length
      }, 'Extracted access token');

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
  inputTokens: number,
  outputTokens: number,
  model: string,
  pricePerMillion: number
): Promise<void> {
  const totalTokens = inputTokens + outputTokens;
  const cost = (totalTokens / 1_000_000) * pricePerMillion;
  const platformFee = cost * 0.15; // 15% platform fee
  const lenderEarnings = cost - platformFee;

  // Deduct from borrower
  await supabase.rpc('deduct_credits', {
    user_id: borrowerId,
    amount: cost,
  });

  // Add to lender (minus platform fee)
  await supabase.rpc('add_credits', {
    user_id: lenderId,
    amount: lenderEarnings,
  });

  // Log the usage
  await supabase.from('usage_logs').insert({
    proxy_key_id: proxyKeyId,
    listing_id: listingId,
    borrower_id: borrowerId,
    lender_id: lenderId,
    model: model || 'unknown',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost,
  });

  // Update listing stats
  await supabase.rpc('increment_listing_stats', {
    listing_id: listingId,
    tokens: totalTokens,
    earnings: lenderEarnings,
  });
}

// Extract auth token from request
function extractAuthToken(request: any): string | null {
  const authHeader = request.headers['authorization'] || request.headers['x-api-key'];

  if (!authHeader) {
    return null;
  }

  // Handle "Bearer token" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
}

// Proxy endpoint for Claude API
fastify.all('/v1/*', async (request, reply) => {
  const proxyKey = extractAuthToken(request);

  if (!proxyKey || !proxyKey.startsWith('sk-proxy-')) {
    return reply.status(401).send({
      error: {
        type: 'authentication_error',
        message: 'Invalid or missing proxy key',
      },
    });
  }

  // Validate proxy key and get associated data
  const validation = await validateProxyKey(proxyKey);

  if (!validation) {
    return reply.status(401).send({
      error: {
        type: 'authentication_error',
        message: 'Invalid proxy key or access revoked',
      },
    });
  }

  const { proxyKeyData, borrower, accessToken } = validation;

  // Check borrower has sufficient credits (minimum $0.01)
  if (borrower.credit_balance < 0.01) {
    return reply.status(402).send({
      error: {
        type: 'payment_required',
        message: 'Insufficient credits. Please add credits at shareyourai.com',
      },
    });
  }

  // Get the path after /v1
  const path = (request.params as any)['*'];
  const targetUrl = `https://api.anthropic.com/v1/${path}`;

  try {
    // Forward the request to Anthropic
    // Claude OAuth tokens (sk-ant-oat01-*) use Bearer auth only
    const response = await fetch(targetUrl, {
      method: request.method as string,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'anthropic-version': request.headers['anthropic-version'] as string || '2023-06-01',
      },
      body: request.method !== 'GET' ? JSON.stringify(request.body) : undefined,
    });

    const responseData = await response.json();

    // Extract token usage from response
    if (responseData.usage) {
      const inputTokens = responseData.usage.input_tokens || 0;
      const outputTokens = responseData.usage.output_tokens || 0;
      const model = responseData.model || (request.body as any)?.model || 'unknown';

      // Log usage asynchronously
      logUsage(
        proxyKeyData.id,
        proxyKeyData.listing_id,
        proxyKeyData.borrower_id,
        proxyKeyData.listings.lender_id,
        inputTokens,
        outputTokens,
        model,
        proxyKeyData.listings.price_per_1m_tokens
      ).catch(err => fastify.log.error({ err }, 'Usage logging failed'));
    }

    // Forward the response
    return reply.status(response.status).send(responseData);
  } catch (error) {
    fastify.log.error({ err: error }, 'Proxy error');
    return reply.status(502).send({
      error: {
        type: 'proxy_error',
        message: 'Failed to forward request to Claude API',
      },
    });
  }
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start the server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001');
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Proxy server running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
