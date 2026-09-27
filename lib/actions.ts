"use server";

import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Stripe from "stripe";

/**
 * Creates a new guest user in Supabase with 20 free credits.
 */
export async function createGuestUser() {
  try {
    const guestClerkId = `guest_${crypto.randomUUID()}`;

    const { data: dbUser, error } = await (supabaseAdmin as any)
      .from("users")
      .insert({
        clerk_id: guestClerkId,
        email: "",
        full_name: "Guest User",
        credits: 20,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating guest user in Supabase:", error);
      return { success: false, error: error.message };
    }

    return { success: true, user: dbUser };
  } catch (error: any) {
    console.error("Unhandled error creating guest user:", error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Retrieves an existing guest user by their stored guest clerk_id.
 */
export async function getGuestUser(guestClerkId: string) {
  try {
    if (!guestClerkId || !guestClerkId.startsWith("guest_")) {
      return { success: false, error: "Invalid guest ID" };
    }

    const { data: dbUser, error } = await (supabaseAdmin as any)
      .from("users")
      .select("*")
      .eq("clerk_id", guestClerkId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching guest user from Supabase:", error);
      return { success: false, error: error.message };
    }

    if (!dbUser) {
      return { success: false, error: "Guest user not found" };
    }

    return { success: true, user: dbUser };
  } catch (error: any) {
    console.error("Unhandled error fetching guest user:", error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Syncs the currently authenticated Clerk user to the 'users' table in Supabase.
 * If a guestClerkId is provided, merges guest chat messages and remaining credits into the permanent account.
 */
export async function syncUser(guestClerkId?: string) {
  try {
    const user = await currentUser();
    if (!user) {
      console.log("No authenticated user found to sync");
      return { success: false, error: "Not authenticated" };
    }

    // Extract user email, fallback to primary or first email
    const primaryEmailObj = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
    const email = primaryEmailObj?.emailAddress || user.emailAddresses[0]?.emailAddress || "";
    
    // Construct full name
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

    // Look up guest user if guestClerkId was provided
    let guestUser: any = null;
    if (guestClerkId && guestClerkId.startsWith("guest_")) {
      const { data: gUser } = await (supabaseAdmin as any)
        .from("users")
        .select("*")
        .eq("clerk_id", guestClerkId)
        .maybeSingle();
      guestUser = gUser;
    }

    // Check if the user already exists in the 'users' table using clerk_id
    const { data: existingUser, error: fetchError } = await (supabaseAdmin as any)
      .from("users")
      .select("*")
      .eq("clerk_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Error looking up existing user in Supabase:", fetchError);
      return { success: false, error: fetchError.message };
    }

    let dbUser;

    if (existingUser) {
      // User exists: Update details and merge guest data if present
      let finalCredits = existingUser.credits;

      if (guestUser && guestUser.id !== existingUser.id) {
        // Transfer messages from guest to existing permanent user
        await (supabaseAdmin as any)
          .from("messages")
          .update({ user_id: existingUser.id })
          .eq("user_id", guestUser.id);

        // Add guest credits
        finalCredits = (existingUser.credits ?? 0) + (guestUser.credits ?? 0);

        // Delete guest row
        await (supabaseAdmin as any)
          .from("users")
          .delete()
          .eq("id", guestUser.id);
      }

      const { data, error: updateError } = await (supabaseAdmin as any)
        .from("users")
        .update({
          email: email,
          full_name: fullName,
          credits: finalCredits,
          updated_at: new Date().toISOString(),
        })
        .eq("clerk_id", user.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating user details in Supabase:", updateError);
        return { success: false, error: updateError.message };
      }
      dbUser = data;
    } else if (guestUser) {
      // User does not exist, but guest exists: Convert guest directly to Clerk user!
      const { data, error: upgradeError } = await (supabaseAdmin as any)
        .from("users")
        .update({
          clerk_id: user.id,
          email: email,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", guestUser.id)
        .select()
        .single();

      if (upgradeError) {
        console.error("Error upgrading guest user to Clerk user:", upgradeError);
        return { success: false, error: upgradeError.message };
      }
      dbUser = data;
    } else {
      // New user without guest account (database defaults credits to 10)
      const { data, error: insertError } = await (supabaseAdmin as any)
        .from("users")
        .insert({
          clerk_id: user.id,
          email: email,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting user details into Supabase:", insertError);
        return { success: false, error: insertError.message };
      }
      dbUser = data;
    }

    return { success: true, user: dbUser };
  } catch (error: any) {
    console.error("Unhandled error syncing user:", error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Fetches all message history for a user, using user_id foreign key.
 */
/**
 * Fetches message history for a user using user_id foreign key with 20-message pagination.
 */
export async function getMessages(
  userDbId: number,
  limit: number = 20,
  beforeId?: number
) {
  try {
    let query = supabaseAdmin
      .from("messages")
      .select("id, sender_type, message_text, is_read, created_at")
      .eq("user_id", userDbId)
      .order("id", { ascending: false })
      .limit(limit);

    if (beforeId) {
      query = query.lt("id", beforeId);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error("Error loading messages from Supabase:", error);
      return { success: false, error: error.message, messages: [], hasMore: false };
    }

    const sorted = [...(messages || [])].reverse();
    const hasMore = (messages || []).length === limit;

    return { success: true, messages: sorted, hasMore };
  } catch (error: any) {
    console.error("Unhandled error loading messages:", error);
    return { success: false, error: error.message || String(error), messages: [], hasMore: false };
  }
}

/**
 * Securely handles sending a user message into Supabase.
 * Checks that credits > 0 before sending, but preserves credit balance
 * so your external Mac backend handles deduction upon AI reply generation.
 */
export async function sendMessageAction(userDbId: number, text: string) {
  try {
    // 1. Fetch latest credits from DB for verification
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("users")
      .select("credits")
      .eq("id", userDbId)
      .single();

    if (userError || !userRecord) {
      console.error("Error fetching user credits:", userError);
      return { success: false, error: "Failed to verify credits" };
    }

    const currentCredits = userRecord.credits ?? 0;

    if (currentCredits <= 0) {
      return { success: false, error: "Out of credits" };
    }

    // 2. Insert User Message
    const { data: userMsg, error: userMsgError } = await supabaseAdmin
      .from("messages")
      .insert({
        user_id: userDbId,
        sender_type: "user",
        message_text: text,
        is_read: false,
      })
      .select("id, created_at")
      .single();

    if (userMsgError || !userMsg) {
      console.error("Error saving user message in Supabase:", userMsgError);
      return { success: false, error: userMsgError?.message || "Failed to save message" };
    }

    // Credits are preserved so external Mac backend script handles credit deduction
    return {
      success: true,
      updatedCredits: currentCredits,
      userMsgId: userMsg.id,
      userMsgCreatedAt: userMsg.created_at,
    };
  } catch (error: any) {
    console.error("Unhandled error sending message:", error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Updates a message status to read = true in the database.
 */
export async function markMessageAsRead(messageId: number) {
  try {
    const { error } = await supabaseAdmin
      .from("messages")
      .update({ is_read: true })
      .eq("id", messageId);

    if (error) {
      console.error("Error marking message as read in Supabase:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Unhandled error marking message as read:", error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Fetches the timestamp of the last message sent by Harnoor across the database.
 */
export async function getLastBotActiveTime() {
  try {
    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("created_at")
      .eq("sender_type", "Harnoor")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching last bot active time:", error);
      return { success: false, createdAt: null };
    }

    return { success: true, createdAt: data?.created_at || null };
  } catch (error: any) {
    console.error("Unhandled error fetching last bot active time:", error);
    return { success: false, createdAt: null };
  }
}

/**
 * Creates a Stripe Checkout Session for purchasing credit packs.
 * Supports USD ($) and INR (₹) currencies (enables UPI for INR transactions).
 */
export async function createCheckoutSession(
  userDbId: number,
  creditsTier: 50 | 100 | 200,
  returnUrl: string,
  currencyCode: string = "usd"
) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_L;
    if (!stripeSecretKey || stripeSecretKey.includes("your_stripe_secret_key_here")) {
      console.error("Missing valid STRIPE_SECRET_KEY in environment variables");
      return { success: false, error: "Stripe API Key is missing in environment variables. Please add STRIPE_SECRET_KEY in Cloudflare settings." };
    }

    const stripe = new Stripe(stripeSecretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const curr = currencyCode.toLowerCase() === "inr" ? "inr" : "usd";
    let unitAmount = 299; // default USD cents ($2.99)

    if (curr === "inr") {
      // 50 credits -> ₹199 INR (19900 paise)
      // 100 credits -> ₹299 INR (29900 paise)
      // 200 credits -> ₹499 INR (49900 paise)
      if (creditsTier === 50) unitAmount = 19900;
      if (creditsTier === 100) unitAmount = 29900;
      if (creditsTier === 200) unitAmount = 49900;
    } else {
      // USD default
      // 50 credits -> $2.99 USD (299 cents)
      // 100 credits -> $4.99 USD (499 cents)
      // 200 credits -> $7.99 USD (799 cents)
      if (creditsTier === 50) unitAmount = 299;
      if (creditsTier === 100) unitAmount = 499;
      if (creditsTier === 200) unitAmount = 799;
    }

    const connector = returnUrl.includes("?") ? "&" : "?";
    const sessions = Math.floor(creditsTier / 50);
    const sessionLabel = sessions === 1 ? "1 chat session" : `${sessions} chat sessions`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price_data: {
            currency: curr,
            product_data: {
              name: `${creditsTier} Backstage Chat Credits`,
              description: `Refill credits. ${creditsTier} credits = ${sessionLabel}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${returnUrl}${connector}payment=success`,
      cancel_url: `${returnUrl}${connector}payment=cancelled`,
      metadata: {
        userId: String(userDbId),
        creditsToBuy: String(creditsTier),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return { success: true, url: session.url };
  } catch (error: any) {
    console.error("Error creating Stripe checkout session:", error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Creates a Dodo Payments checkout session for UPI / Global payments.
 */
export async function createDodoCheckoutSession(
  userDbId: number,
  creditsTier: 50 | 100 | 200,
  returnUrl: string
) {
  try {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) {
      console.error("Missing DODO_PAYMENTS_API_KEY");
      return { success: false, error: "Dodo Payments configuration missing" };
    }

    const endpoint = process.env.DODO_PAYMENTS_ENDPOINT || "https://test.dodopayments.com";

    let productId = "";
    if (creditsTier === 50) productId = process.env.DODO_PRODUCT_50 || "";
    else if (creditsTier === 100) productId = process.env.DODO_PRODUCT_100 || "";
    else if (creditsTier === 200) productId = process.env.DODO_PRODUCT_200 || "";

    if (!productId) {
      return { success: false, error: "Invalid credit tier or missing product ID" };
    }

    // Query user details from Supabase to prefill customer info so user is never asked for name/email/address
    const { data: dbUser } = await (supabaseAdmin as any)
      .from("users")
      .select("email, full_name")
      .eq("id", userDbId)
      .single();

    const customerName = dbUser?.full_name?.trim() || "Backstage Member";
    const customerEmail =
      dbUser?.email && dbUser.email.includes("@")
        ? dbUser.email.trim()
        : `member_${userDbId}@backstagechat.me`;

    const connector = returnUrl.includes("?") ? "&" : "?";
    const redirectUrl = `${returnUrl}${connector}provider=dodo`;

    const res = await fetch(`${endpoint}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        billing_currency: "INR",
        billing_address: {
          country: "IN",
          city: "New Delhi",
          street: "Connaught Place",
          state: "Delhi",
          zipcode: "110001",
        },
        confirm: true,
        allowed_payment_method_types: ["upi_intent"],
        customer: {
          name: customerName,
          email: customerEmail,
          phone_number: "+919876543210",
        },
        return_url: redirectUrl,
        metadata: {
          userId: String(userDbId),
          creditsToBuy: String(creditsTier),
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Dodo checkout creation failed:", res.status, errText);
      return { success: false, error: `Checkout creation failed: ${errText}` };
    }

    const data = (await res.json()) as { checkout_url?: string; session_id?: string };
    if (!data.checkout_url) {
      return { success: false, error: "No checkout URL returned by Dodo Payments" };
    }

    return {
      success: true,
      url: data.checkout_url,
      sessionId: data.session_id,
    };
  } catch (error: any) {
    console.error("Error creating Dodo checkout session:", error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Creates a Stripe PaymentIntent for embedded Express Checkout Elements (Apple Pay, Google Pay, Link).
 */
export async function createPaymentIntentAction(
  userDbId: number,
  creditsTier: 50 | 100 | 200,
  currencyCode: string = "USD"
) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_L;
    if (!stripeSecretKey) {
      console.error("Missing STRIPE_SECRET_KEY in environment variables");
      return { success: false, error: "Stripe configuration error" };
    }

    const stripe = new Stripe(stripeSecretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const curr = currencyCode.toLowerCase() === "inr" ? "inr" : "usd";
    let unitAmount = 299;

    if (curr === "inr") {
      // 50 credits -> ₹199 (19900 paise)
      // 100 credits -> ₹299 (29900 paise)
      // 200 credits -> ₹499 (49900 paise)
      if (creditsTier === 50) unitAmount = 19900;
      if (creditsTier === 100) unitAmount = 29900;
      if (creditsTier === 200) unitAmount = 49900;
    } else {
      // USD in cents
      if (creditsTier === 50) unitAmount = 299;
      if (creditsTier === 100) unitAmount = 499;
      if (creditsTier === 200) unitAmount = 799;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: unitAmount,
      currency: curr,
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: String(userDbId),
        creditsToBuy: String(creditsTier),
        currency: curr,
        source: "express_checkout",
      },
    });

    if (!paymentIntent.client_secret) {
      return { success: false, error: "Failed to generate payment client secret" };
    }

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: any) {
    console.error("Error creating Stripe PaymentIntent:", error);
    return { success: false, error: error.message || String(error) };
  }
}

// Cache processed payment IDs to prevent duplicate crediting between redirect and webhook
const processedPaymentIds = new Set<string>();

/**
 * Safely processes a successful payment and adds credits to the user in Supabase.
 * Idempotent: checks processedPaymentIds to avoid double crediting.
 */
export async function processPaymentSuccess(
  userDbId: number,
  creditsToBuy: number,
  paymentId: string
) {
  try {
    if (processedPaymentIds.has(paymentId)) {
      console.log(`Payment ${paymentId} already processed for user ${userDbId}`);
      const { data: user } = await (supabaseAdmin as any)
        .from("users")
        .select("credits")
        .eq("id", userDbId)
        .single();
      return { success: true, credits: user?.credits ?? 0, alreadyProcessed: true };
    }

    processedPaymentIds.add(paymentId);

    const { data: user, error: userError } = await (supabaseAdmin as any)
      .from("users")
      .select("credits")
      .eq("id", userDbId)
      .single();

    if (userError || !user) {
      processedPaymentIds.delete(paymentId);
      console.error(`Error fetching user ${userDbId}:`, userError);
      return { success: false, error: userError?.message || "User not found" };
    }

    const currentCredits = user.credits ?? 0;
    const newCredits = currentCredits + creditsToBuy;

    const { error: updateError } = await (supabaseAdmin as any)
      .from("users")
      .update({
        credits: newCredits,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userDbId);

    if (updateError) {
      processedPaymentIds.delete(paymentId);
      console.error(`Error updating credits for user ${userDbId}:`, updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`[Payment] Added ${creditsToBuy} credits to user ${userDbId}. New balance: ${newCredits}`);
    return { success: true, credits: newCredits, alreadyProcessed: false };
  } catch (err: any) {
    processedPaymentIds.delete(paymentId);
    console.error("Error in processPaymentSuccess:", err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Verifies any recently succeeded Dodo payments for a user and credits them immediately.
 * Called automatically when user redirects back with ?payment=success.
 */
export async function syncDodoPaymentOnRedirect(
  userDbId: number,
  paymentId?: string
): Promise<{ success: boolean; credits?: number; error?: string; alreadyProcessed?: boolean }> {
  try {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) {
      console.error("Missing DODO_PAYMENTS_API_KEY in environment variables");
      return { success: false, error: "Missing Dodo API key" };
    }

    const endpoint = process.env.DODO_PAYMENTS_ENDPOINT || "https://test.dodopayments.com";

    // 1. If paymentId is available from redirect query params, retrieve the exact payment record
    if (paymentId) {
      console.log(`[Dodo Redirect Sync] Checking payment ${paymentId} for user ${userDbId}...`);
      const res = await fetch(`${endpoint}/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      });

      if (res.ok) {
        const payment = await res.json();
        console.log(`[Dodo Redirect Sync] Payment ${paymentId} status: ${payment.status}`);

        if (payment.status === "succeeded") {
          let creditsToBuy = parseInt(payment.metadata?.creditsToBuy || "0", 10);
          if (isNaN(creditsToBuy) || creditsToBuy <= 0) {
            const amt = payment.total_amount || payment.amount || 0;
            if (amt === 19900 || amt === 199) creditsToBuy = 50;
            else if (amt === 29900 || amt === 299) creditsToBuy = 100;
            else if (amt === 49900 || amt === 499) creditsToBuy = 200;
            else creditsToBuy = 50;
          }
          const result = await processPaymentSuccess(userDbId, creditsToBuy, payment.payment_id || paymentId);
          return result;
        } else {
          return { success: false, error: `Payment status is ${payment.status}` };
        }
      } else {
        const errText = await res.text();
        console.error(`[Dodo Redirect Sync] Failed to fetch payment ${paymentId}: ${res.status}`, errText);
      }
    }

    // 2. Fallback: fetch current credits from Supabase
    const { data: user } = await (supabaseAdmin as any)
      .from("users")
      .select("credits")
      .eq("id", userDbId)
      .single();

    return { success: true, credits: user?.credits ?? 0 };
  } catch (err: any) {
    console.error("Error in syncDodoPaymentOnRedirect:", err);
    return { success: false, error: err.message || String(err) };
  }
}
