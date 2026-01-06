import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient() as any;
  const { searchParams } = new URL(request.url);

  const myListings = searchParams.get('my') === 'true';

  if (myListings) {
    // Get user's own listings
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: listings, error } = await supabase
      .from('listings')
      .select(`
        *,
        claude_accounts (
          subscription_type,
          rate_limit_tier,
          is_valid
        )
      `)
      .eq('lender_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ listings });
  }

  // Get all active listings (marketplace)
  const { data: listings, error } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      description,
      price_per_1m_tokens,
      max_concurrent,
      total_tokens_served,
      rating_avg,
      rating_count,
      created_at,
      claude_accounts (
        subscription_type,
        rate_limit_tier
      )
    `)
    .eq('is_active', true)
    .order('rating_avg', { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ listings });
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
    const { claude_account_id, title, description, price_per_1m_tokens, max_concurrent } = body;

    // Validate required fields
    if (!claude_account_id) {
      return NextResponse.json(
        { error: 'Claude account is required' },
        { status: 400 }
      );
    }

    if (!title || title.trim().length < 3) {
      return NextResponse.json(
        { error: 'Title must be at least 3 characters' },
        { status: 400 }
      );
    }

    // Verify the Claude account belongs to this user and is valid
    const { data: account, error: accountError } = await supabase
      .from('claude_accounts')
      .select('id, is_valid')
      .eq('id', claude_account_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Invalid Claude account' },
        { status: 400 }
      );
    }

    if (!account.is_valid) {
      return NextResponse.json(
        { error: 'Claude account is not valid. Please re-validate your tokens.' },
        { status: 400 }
      );
    }

    // Check if a listing already exists for this account
    const { data: existingListing } = await supabase
      .from('listings')
      .select('id')
      .eq('claude_account_id', claude_account_id)
      .single();

    if (existingListing) {
      return NextResponse.json(
        { error: 'A listing already exists for this Claude account' },
        { status: 400 }
      );
    }

    // Create the listing
    const { data: listing, error: insertError } = await supabase
      .from('listings')
      .insert({
        lender_id: user.id,
        claude_account_id,
        title: title.trim(),
        description: description?.trim() || null,
        price_per_1m_tokens: Math.max(0.5, Math.min(50, price_per_1m_tokens || 3)),
        max_concurrent: Math.max(1, Math.min(10, max_concurrent || 1)),
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Listing creation error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create listing' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      listing,
      message: 'Listing created successfully',
    });
  } catch (error) {
    console.error('Listing creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
