"use server";

import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBotResponse } from "@/app/chatLogic";

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
 * Fetches all message history for a user.
 */
export async function getMessages(userDbId: number) {
  try {
    const { data: messages, error } = await supabaseAdmin
      .from("messages")
      .select("id, sender_type, message_text, created_at")
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
    const { error: userMsgError } = await supabaseAdmin
      .from("messages")
      .insert({
        user_id: userDbId,
        sender_type: "user",
        message_text: text,
      });

    if (userMsgError) {
      console.error("Error saving user message in Supabase:", userMsgError);
      return { success: false, error: userMsgError.message };
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

    // 5. Insert Bot Message
    const { error: botMsgError } = await supabaseAdmin
      .from("messages")
      .insert({
        user_id: userDbId,
        sender_type: "ai",
        message_text: botReply.text,
      });

    if (botMsgError) {
      console.error("Error saving bot message in Supabase:", botMsgError);
      return { success: false, error: botMsgError.message };
    }

    return {
      success: true,
      updatedCredits: nextCredits,
      botReply: botReply.text,
      delayMs: botReply.delayMs,
    };
  } catch (error: any) {
    console.error("Unhandled error sending message:", error);
    return { success: false, error: error.message || String(error) };
  }
}
