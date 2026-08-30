"use server";

import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Stripe from "stripe";

/**
 * Syncs the currently authenticated Clerk user to the 'users' table in Supabase.
 * Maps Clerk fields to your database schema (clerk_id, email, full_name, etc.).
 * Returns the matched database row containing the database auto-incremented 'id' and 'credits'.
 */
export async function syncUser() {
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

    // Check if the user already exists in the 'users' table using clerk_id
    const { data: existingUser, error: fetchError } = await supabaseAdmin
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
      // User exists: Update details
      const { data, error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          email: email,
          full_name: fullName,
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
    } else {
      // User does not exist: Create new record (database defaults credits to 10)
      const { data, error: insertError } = await supabaseAdmin
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
      // 100 credits -> ₹349 INR (34900 paise)
      // 200 credits -> ₹549 INR (54900 paise)
      if (creditsTier === 50) unitAmount = 19900;
      if (creditsTier === 100) unitAmount = 34900;
      if (creditsTier === 200) unitAmount = 54900;
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
    let unitAmount = 499; // Default 100 credits = $4.99 USD (499 cents)

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
