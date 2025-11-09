import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getAuthUser } from '@/utils/supabase-auth';
import { isPlanTier, PLAN_CONFIG, PlanTier } from '@/lib/planConfig';
import { getStripePriceId } from '@/utils/planPricing';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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
    const { plan } = req.body as { plan: PlanTier };

    if (!isPlanTier(plan)) {
      return res.status(400).json({ message: 'Invalid plan' });
    }

    const priceId = getStripePriceId(plan);
    if (!priceId) {
      return res.status(400).json({ message: 'Plan not available' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: user.email || undefined,
      metadata: {
        userId: user.id,
        plan,
      },
      allow_promotion_codes: true,
      success_url: `${appUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/plans?payment=cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('[Stripe] create checkout session error:', error);
    return res.status(500).json({
      message: 'Failed to create checkout session',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
