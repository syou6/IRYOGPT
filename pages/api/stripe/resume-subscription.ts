import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getAuthUser, getSupabaseAdminClient } from '@/utils/supabase-auth';

const stripeSecret = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
    })
  : null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!stripe) {
    return res.status(500).json({ message: 'Stripe is not configured' });
  }

  try {
    const user = await getAuthUser(req);
    const supabaseAdmin = getSupabaseAdminClient();

    const { data: userRecord, error } = await supabaseAdmin
      .from('users')
      .select('stripe_subscription_id, cancel_at_period_end, subscription_status')
      .eq('id', user.id)
      .single();

    if (error) {
      throw error;
    }

    if (!userRecord?.stripe_subscription_id) {
      return res.status(400).json({
        message: 'No subscription found to resume',
      });
    }

    if (!userRecord.cancel_at_period_end) {
      return res.status(200).json({
        status: userRecord.subscription_status ?? 'active',
        cancel_at_period_end: false,
        message: 'Subscription is already active',
      });
    }

    const updatedSubscription = await stripe.subscriptions.update(
      userRecord.stripe_subscription_id,
      {
        cancel_at_period_end: false,
      },
    );

    await supabaseAdmin
      .from('users')
      .update({
        subscription_status: updatedSubscription.status,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end ?? false,
      })
      .eq('id', user.id);

    return res.status(200).json({
      status: updatedSubscription.status,
      cancel_at_period_end: updatedSubscription.cancel_at_period_end,
    });
  } catch (error: any) {
    console.error('[Stripe] resume subscription error:', error);
    if (error?.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    return res.status(500).json({
      message: 'Failed to resume subscription',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
