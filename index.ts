// Reçoit les événements Stripe et met à jour la table "subscriptions".
// À déployer avec : supabase functions deploy stripe-webhook --no-verify-jwt
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

async function userIdFromCustomer(customer: string): Promise<string | null> {
  const { data } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', customer).maybeSingle();
  return data?.user_id ?? null;
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('missing signature', { status: 400 });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!, undefined, cryptoProvider,
    );
  } catch (e) {
    console.error('signature invalide', e);
    return new Response('invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const s = event.data.object as Stripe.Subscription;
        const customer = typeof s.customer === 'string' ? s.customer : s.customer.id;
        const userId = s.metadata?.user_id || (await userIdFromCustomer(customer));
        if (!userId) break;
        const interval = s.items.data[0]?.price?.recurring?.interval;
        await admin.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: customer,
          stripe_subscription_id: s.id,
          status: s.status,
          plan: interval === 'year' ? 'y' : 'm',
          trial_end: iso(s.trial_end),
          current_period_end: iso(s.current_period_end),
          cancel_at_period_end: s.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        });
        break;
      }
      case 'checkout.session.completed': {
        const cs = event.data.object as Stripe.Checkout.Session;
        if (cs.mode === 'payment' && cs.payment_status === 'paid') {
          const customer = typeof cs.customer === 'string' ? cs.customer : cs.customer?.id;
          const userId = cs.metadata?.user_id || (customer ? await userIdFromCustomer(customer) : null);
          if (!userId) break;
          const until = new Date(Date.now() + 84 * 24 * 3600 * 1000).toISOString(); // 12 semaines
          await admin.from('subscriptions').upsert({
            user_id: userId,
            ...(customer ? { stripe_customer_id: customer } : {}),
            entitlement_until: until,
            updated_at: new Date().toISOString(),
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('traitement webhook', e);
    return new Response('error', { status: 500 });   // Stripe réessaiera
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
