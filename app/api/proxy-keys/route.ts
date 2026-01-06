import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

function generateProxyKey(): string {
  const random = randomBytes(24).toString('base64url');
  return `sk-proxy-${random}`;
}

export async function GET() {
  const supabase = await createClient() as any;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: proxyKeys, error } = await supabase
    .from('proxy_keys')
    .select(`
      id,
      key_prefix,
      is_active,
      created_at,
      listings (
        id,
        title,
        price_per_1m_tokens
      )
    `)
    .eq('borrower_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ proxyKeys });
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
    const { listing_id } = body;

    if (!listing_id) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    // Get user's credit balance
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credit_balance')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Could not fetch user data' },
        { status: 500 }
      );
    }

    // Require minimum balance (e.g., $1)
    if ((userData.credit_balance || 0) < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits. Please add at least $1 to get started.' },
        { status: 400 }
      );
    }

    // Verify the listing exists and is active
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, lender_id, is_active, max_concurrent')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    if (!listing.is_active) {
      return NextResponse.json(
        { error: 'This listing is not currently active' },
        { status: 400 }
      );
    }

    // Prevent lenders from getting their own listing
    if (listing.lender_id === user.id) {
      return NextResponse.json(
        { error: 'You cannot get access to your own listing' },
        { status: 400 }
      );
    }

    // Check if user already has an active key for this listing
    const { data: existingKey } = await supabase
      .from('proxy_keys')
      .select('id')
      .eq('borrower_id', user.id)
      .eq('listing_id', listing_id)
      .eq('is_active', true)
      .single();

    if (existingKey) {
      return NextResponse.json(
        { error: 'You already have an active proxy key for this listing' },
        { status: 400 }
      );
    }

    // Check concurrent users
    const { count: activeKeys } = await supabase
      .from('proxy_keys')
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listing_id)
      .eq('is_active', true);

    if (activeKeys !== null && activeKeys >= listing.max_concurrent) {
      return NextResponse.json(
        { error: 'This listing has reached its maximum concurrent users. Please try again later.' },
        { status: 400 }
      );
    }

    // Generate proxy key
    const proxyKey = generateProxyKey();
    const keyHash = await bcrypt.hash(proxyKey, 10);
    const keyPrefix = proxyKey.substring(0, 16);

    // Create proxy key record
    const { data: proxyKeyRecord, error: insertError } = await supabase
      .from('proxy_keys')
      .insert({
        borrower_id: user.id,
        listing_id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
      })
      .select('id, key_prefix, created_at')
      .single();

    if (insertError) {
      console.error('Proxy key creation error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create proxy key' },
        { status: 500 }
      );
    }

    // Return the plaintext key (only time it's shown!)
    return NextResponse.json({
      success: true,
      proxyKey: {
        id: proxyKeyRecord.id,
        key: proxyKey, // Only returned once!
        key_prefix: keyPrefix,
        created_at: proxyKeyRecord.created_at,
      },
      setup: {
        baseUrl: process.env.NEXT_PUBLIC_PROXY_URL || 'https://api.shareyourai.com',
        instructions: `Add these to your shell profile:\n\nexport ANTHROPIC_BASE_URL=${process.env.NEXT_PUBLIC_PROXY_URL || 'https://api.shareyourai.com'}\nexport ANTHROPIC_AUTH_TOKEN=${proxyKey}\n\nThen run: claude`,
      },
      message: 'Proxy key created successfully. Save this key - it will not be shown again!',
    });
  } catch (error) {
    console.error('Proxy key creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
