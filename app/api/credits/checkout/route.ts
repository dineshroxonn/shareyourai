import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const creditOptions: Record<number, { bonus: number }> = {
  5: { bonus: 0 },
  10: { bonus: 0 },
  25: { bonus: 5 },
  50: { bonus: 15 },
  100: { bonus: 35 },
};

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
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY is not set');
      return NextResponse.json(
        { error: 'Payment system not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { amount } = body;

    if (!creditOptions[amount]) {
      return NextResponse.json(
        { error: 'Invalid credit amount' },
        { status: 400 }
      );
    }

    const totalCredits = amount + creditOptions[amount].bonus;
    // Clean up the site URL - remove trailing slashes and any whitespace/newlines
    const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shareyourai.vercel.app';
    const siteUrl = rawSiteUrl.replace(/[\s\n\r]+/g, '').replace(/\/+$/, '');

    const successUrl = `${siteUrl}/dashboard/credits?success=true&amount=${totalCredits}`;
    const cancelUrl = `${siteUrl}/dashboard/credits?canceled=true`;

    console.log('Creating checkout with URLs:', { successUrl, cancelUrl, siteUrl: rawSiteUrl });

    // Create Stripe checkout session using fetch API
    const params = new URLSearchParams();
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('mode', 'payment');
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', `${totalCredits} ShareYourAI Credits`);
    params.append('line_items[0][price_data][product_data][description]',
      creditOptions[amount].bonus > 0
        ? `$${amount} + $${creditOptions[amount].bonus} bonus`
        : `$${amount} credits`
    );
    params.append('line_items[0][price_data][unit_amount]', String(amount * 100));
    params.append('line_items[0][quantity]', '1');
    params.append('metadata[user_id]', user.id);
    params.append('metadata[credit_amount]', String(totalCredits));

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      console.error('Stripe API error:', session);
      return NextResponse.json(
        {
          error: session.error?.message || 'Failed to create checkout session',
          debug: { successUrl, cancelUrl, stripeError: session.error }
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
