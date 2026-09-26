import { headers } from "next/headers";
import { Webhook } from "standardwebhooks";
import { processPaymentSuccess } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing DODO_PAYMENTS_WEBHOOK_SECRET in environment variables");
    return new Response("Server configuration error: Missing Dodo webhook secret", { status: 500 });
  }

  const headerList = await headers();
  const rawBody = await req.text();

  const webhookHeaders = {
    "webhook-id": headerList.get("webhook-id") || "",
    "webhook-signature": headerList.get("webhook-signature") || "",
    "webhook-timestamp": headerList.get("webhook-timestamp") || "",
  };

  const webhook = new Webhook(webhookSecret);

  try {
    webhook.verify(rawBody, webhookHeaders);
  } catch (err: any) {
    console.error(`Dodo Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch (err: any) {
    console.error("Failed to parse Dodo webhook JSON body:", err);
    return new Response("Invalid JSON payload", { status: 400 });
  }

  const eventType = event.type || event.event_type;
  console.log(`Dodo event received: ${eventType}`);

  if (eventType === "payment.succeeded") {
    const data = event.data || {};
    const metadata = data.metadata || {};
    const paymentId = data.payment_id || data.id || event.id || `dodo_${Date.now()}`;

    const userIdStr = metadata.userId;
    const creditsToBuyStr = metadata.creditsToBuy;

    if (userIdStr && creditsToBuyStr) {
      const userDbId = parseInt(userIdStr, 10);
      const creditsToBuy = parseInt(creditsToBuyStr, 10);

      if (!isNaN(userDbId) && !isNaN(creditsToBuy) && creditsToBuy > 0) {
        await processPaymentSuccess(userDbId, creditsToBuy, paymentId);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
