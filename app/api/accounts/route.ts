import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { encryptToken } from '@/utils/shareyourai/encryption';
import {
  parseClaudeToken,
  validateTokenWithAnthropic,
  getTokenExpirationDate,
} from '@/utils/shareyourai/claude-token';

export async function GET() {
  const supabase = await createClient() as any;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: accounts, error } = await supabase
    .from('claude_accounts')
    .select('id, subscription_type, rate_limit_tier, is_valid, last_validated_at, created_at, token_expires_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const supabase = await createClient() as any;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tokenJson } = body;

    if (!tokenJson || typeof tokenJson !== 'string') {
      return NextResponse.json(
        { error: 'Token JSON is required' },
        { status: 400 }
      );
    }

    // Parse and validate token structure
    let parsedToken;
    try {
      parsedToken = parseClaudeToken(tokenJson);
    } catch (parseError) {
      return NextResponse.json(
        {
          error:
            parseError instanceof Error
              ? parseError.message
              : 'Invalid token format',
        },
        { status: 400 }
      );
    }

    // Validate token with Anthropic
    const validation = await validateTokenWithAnthropic(
      parsedToken.claudeAiOauth.accessToken
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Token validation failed' },
        { status: 400 }
      );
    }

    // Encrypt the token
    let encrypted: string;
    let nonce: string;
    try {
      const encResult = encryptToken(tokenJson);
      encrypted = encResult.encrypted;
      nonce = encResult.nonce;
    } catch (encError) {
      console.error('Encryption error:', encError);
      return NextResponse.json(
        { error: 'Failed to encrypt token', details: encError instanceof Error ? encError.message : 'Unknown' },
        { status: 500 }
      );
    }

    // Store in database
    const { data: account, error: insertError } = await supabase
      .from('claude_accounts')
      .insert({
        user_id: user.id,
        encrypted_tokens: encrypted,
        token_nonce: nonce,
        token_expires_at: getTokenExpirationDate(parsedToken).toISOString(),
        subscription_type: parsedToken.claudeAiOauth.subscriptionType,
        rate_limit_tier: parsedToken.claudeAiOauth.rateLimitTier,
        is_valid: true,
        last_validated_at: new Date().toISOString(),
      })
      .select('id, subscription_type, rate_limit_tier, is_valid, created_at')
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save account', details: insertError.message, code: insertError.code },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      account,
      message: 'Claude account added successfully',
    });
  } catch (error) {
    console.error('Account creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
