import type { NextApiRequest, NextApiResponse } from 'next';
import { Readable } from 'stream';
import Stripe from 'stripe';
import { isPlanTier, PlanTier } from '@/lib/planConfig';
import { getPlanUpdatePayload } from '@/utils/planPricing';
import { getSupabaseAdminClient } from '@/utils/supabase-auth';

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
    })
  : null;

async function buffer(readable: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!stripe || !webhookSecret) {
    console.error('[Stripe] Webhook not configured');
    return res.status(500).json({ received: false });
  }

  let event: Stripe.Event;

  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      return res.status(400).json({ message: 'Missing signature header' });
    }

    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = session.metadata?.plan;
      const userId = session.metadata?.userId;
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id || null;
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id || null;

      if (!userId || !plan || !isPlanTier(plan as PlanTier)) {
        console.warn('[Stripe] Missing metadata on checkout session');
      } else {
        const updatePayload = getPlanUpdatePayload(plan as PlanTier);
        const supabaseAdmin = getSupabaseAdminClient();

        await supabaseAdmin
          .from('users')
          .update({
            plan: updatePayload.plan,
            chat_quota: updatePayload.chat_quota,
            embedding_quota: updatePayload.embedding_quota,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            subscription_status: 'active',
            cancel_at_period_end: false,
          })
          .eq('id', userId);

        console.log(`[Stripe] Updated plan for user ${userId} -> ${plan}`);
      }
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id || null;

      const supabaseAdmin = getSupabaseAdminClient();
      const updatePayload: Record<string, any> = {
        subscription_status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      };

      if (customerId) {
        updatePayload.stripe_customer_id = customerId;
      }

      await supabaseAdmin
        .from('users')
        .update(updatePayload)
        .eq('stripe_subscription_id', subscription.id);

      console.log(
        `[Stripe] Subscription updated ${subscription.id} status=${subscription.status} cancel_at_period_end=${subscription.cancel_at_period_end}`,
      );
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const supabaseAdmin = getSupabaseAdminClient();

      await supabaseAdmin
        .from('users')
        .update({
          plan: 'pending',
          chat_quota: 0,
          embedding_quota: 0,
          subscription_status: subscription.status,
          cancel_at_period_end: false,
          stripe_subscription_id: null,
        })
        .eq('stripe_subscription_id', subscription.id);

      console.log(`[Stripe] Subscription canceled ${subscription.id}, user returned to pending plan`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Stripe] Webhook handler error:', error);
    return res.status(500).json({ received: true });
  }
}
