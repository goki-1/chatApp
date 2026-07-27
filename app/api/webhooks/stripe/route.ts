import { headers } from "next/headers";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET in environment variables");
    return new Response("Server configuration error: Missing Stripe secrets", { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);

  const headerList = await headers();
  const signature = headerList.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Stripe Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`Stripe event received: ${event.type}`);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userIdStr = session.metadata?.userId;
    const creditsToBuyStr = session.metadata?.creditsToBuy;

    if (userIdStr && creditsToBuyStr) {
      const userDbId = parseInt(userIdStr, 10);
      const creditsToBuy = parseInt(creditsToBuyStr, 10);

      if (!isNaN(userDbId) && !isNaN(creditsToBuy) && creditsToBuy > 0) {
        // Fetch current credits for the user
        const { data: user, error: userError } = await supabaseAdmin
          .from("users")
          .select("credits")
          .eq("id", userDbId)
          .single();

        if (userError) {
          console.error(`Error fetching user ${userDbId} for credit update:`, userError);
          return new Response(`Database Error: ${userError.message}`, { status: 500 });
        }

        const currentCredits = user?.credits ?? 0;
        const updatedCredits = currentCredits + creditsToBuy;

        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;

        // Update user credits and stripe_customer_id in Supabase
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            credits: updatedCredits,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userDbId);

        if (updateError) {
          console.error(`Error updating credits for user ${userDbId}:`, updateError);
          return new Response(`Database Update Error: ${updateError.message}`, { status: 500 });
        }

        console.log(`Successfully added ${creditsToBuy} credits to user ID ${userDbId}. New balance: ${updatedCredits}`);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
