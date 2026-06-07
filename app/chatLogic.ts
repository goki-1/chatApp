export interface BotResponse {
  text: string;
  delayMs: number;
}

/**
 * Generates a simulated response from Alessia V. based on user input,
 * along with a customized delay for the typing indicator.
 * 
 * You can modify these conditional checks and timing parameters to customize the bot behavior.
 */
export function getBotResponse(userInput: string): BotResponse {
  const normalizedInput = userInput.toLowerCase();
  
  // Default fallback response
  let text = "I love hearing your thoughts. Connecting like this directly is exactly why I created Backstage. Tell me more about what drives you?";
  let delayMs = 1500;

  // Custom response logic
  if (normalizedInput.includes("tour") || normalizedInput.includes("concert") || normalizedInput.includes("paris") || normalizedInput.includes("stage")) {
    text = "Touring is an absolute dream, but it's incredibly intense! That Paris stage design was inspired by raw architecture. The energy from you guys is honestly what keeps me going night after night.";
    delayMs = 1800;
  } else if (normalizedInput.includes("music") || normalizedInput.includes("album") || normalizedInput.includes("song") || normalizedInput.includes("sing")) {
    text = "I've been in the studio lately searching for some deeper, raw sounds. It feels so liberating to create without limits. I'll make sure to share the new demos here first!";
    delayMs = 2000;
  } else if (normalizedInput.includes("hello") || normalizedInput.includes("hi") || normalizedInput.includes("hey")) {
    text = "Hey! Wonderful to connect with you. How is your day going? What are you working on or excited about right now?";
    delayMs = 1000;
  }

  return { text, delayMs };
}
