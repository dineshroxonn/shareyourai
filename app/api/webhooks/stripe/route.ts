import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const creditAmount = parseFloat(session.metadata?.credit_amount || '0');

      if (userId && creditAmount > 0) {
        // Add credits to user's balance
        const { data: user, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('credit_balance')
          .eq('id', userId)
          .single();

        if (!fetchError && user) {
          const newBalance = (user.credit_balance || 0) + creditAmount;

          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ credit_balance: newBalance })
            .eq('id', userId);

          if (updateError) {
            console.error('Failed to update credit balance:', updateError);
          } else {
            // Record the transaction
            await supabaseAdmin.from('transactions').insert({
              user_id: userId,
              type: 'credit_purchase',
              amount: creditAmount,
              description: `Purchased ${creditAmount} credits`,
              stripe_payment_id: session.payment_intent as string,
            });

            console.log(`Added ${creditAmount} credits to user ${userId}`);
          }
        }
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
