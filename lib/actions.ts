"use server";

import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBotResponse } from "@/app/chatLogic";
import Stripe from "stripe";

/**
 * Syncs the currently authenticated Clerk user to the 'users' table in Supabase.
 * Maps Clerk fields to your database schema (clerk_id, email, full_name, last_seen_at, etc.).
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
      // User exists: Update details and last_seen_at
      const { data, error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          email: email,
          full_name: fullName,
          last_seen_at: new Date().toISOString(),
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
          last_seen_at: new Date().toISOString(),
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
export async function getMessages(userDbId: number) {
  try {
    const { data: messages, error } = await supabaseAdmin
      .from("messages")
      .select("id, sender_type, message_text, is_read, created_at")
      .eq("user_id", userDbId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages from Supabase:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messages };
  } catch (error: any) {
    console.error("Unhandled error loading messages:", error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Securely handles sending a user message, verifying credits, and generating bot reply.
 * Runs in a secure server-side context.
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

    // 3. Decrement user's credits by 1
    const nextCredits = currentCredits - 1;
    const { error: updateCreditsError } = await supabaseAdmin
      .from("users")
      .update({
        credits: nextCredits,
      })
      .eq("id", userDbId);

    if (updateCreditsError) {
      console.error("Error updating user credits in Supabase:", updateCreditsError);
      return { success: false, error: updateCreditsError.message };
    }

    // 4. Generate bot reply
    const botReply = getBotResponse(text);

    // 5. Insert Bot Message (Harnoor)
    const { data: botMsg, error: botMsgError } = await supabaseAdmin
      .from("messages")
      .insert({
        user_id: userDbId,
        sender_type: "Harnoor",
        message_text: botReply.text,
        is_read: true,
      })
      .select("id, created_at")
      .single();

    if (botMsgError || !botMsg) {
      console.error("Error saving bot message in Supabase:", botMsgError);
      return { success: false, error: botMsgError?.message || "Failed to save bot response" };
    }

    return {
      success: true,
      updatedCredits: nextCredits,
      userMsgId: userMsg.id,
      userMsgCreatedAt: userMsg.created_at,
      botMsgId: botMsg.id,
      botMsgCreatedAt: botMsg.created_at,
      botReply: botReply.text,
      delayMs: botReply.delayMs,
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
 * Supports multi-currency pricing and enables UPI for INR transactions.
 */
export async function createCheckoutSession(
  userDbId: number,
  creditsTier: 50 | 100 | 200,
  originUrl: string,
  currencyCode: string = "cad"
) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey || stripeSecretKey.includes("your_stripe_secret_key_here")) {
      console.error("Missing valid STRIPE_SECRET_KEY in environment variables");
      return { success: false, error: "Stripe API Key is missing in .env.local. Please configure STRIPE_SECRET_KEY." };
    }

    const stripe = new Stripe(stripeSecretKey);

    const curr = currencyCode.toLowerCase();
    let unitAmount = 300; // default CAD cents ($3.00)

    if (curr === "inr") {
      // 50 credits -> ₹200 INR (20000 paise)
      // 100 credits -> ₹300 INR (30000 paise)
      // 200 credits -> ₹500 INR (50000 paise)
      if (creditsTier === 50) unitAmount = 20000;
      if (creditsTier === 100) unitAmount = 30000;
      if (creditsTier === 200) unitAmount = 50000;
    } else if (curr === "usd") {
      if (creditsTier === 50) unitAmount = 220;
      if (creditsTier === 100) unitAmount = 370;
      if (creditsTier === 200) unitAmount = 600;
    } else if (curr === "eur") {
      if (creditsTier === 50) unitAmount = 200;
      if (creditsTier === 100) unitAmount = 340;
      if (creditsTier === 200) unitAmount = 550;
    } else if (curr === "gbp") {
      if (creditsTier === 50) unitAmount = 175;
      if (creditsTier === 100) unitAmount = 290;
      if (creditsTier === 200) unitAmount = 470;
    } else {
      // CAD default
      if (creditsTier === 50) unitAmount = 300;
      if (creditsTier === 100) unitAmount = 500;
      if (creditsTier === 200) unitAmount = 800;
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price_data: {
            currency: curr,
            product_data: {
              name: `${creditsTier} Backstage Chat Credits`,
              description: `Refill pack for ${creditsTier} chat messages`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${originUrl}?payment=success`,
      cancel_url: `${originUrl}?payment=cancelled`,
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
