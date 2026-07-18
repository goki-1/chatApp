"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { syncUser, getMessages, sendMessageAction } from "@/lib/actions";

interface Message {
  id: string;
  sender: "Harnoor" | "user";
  text: string;
  timestamp: string;
}

export default function Home() {
  const { isLoaded: authLoaded, userId } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  const clerk = useClerk();

  // Landing page guest input state
  const [landingInput, setLandingInput] = useState("");

  // Authenticated chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "Harnoor",
      text: "Hi Tell me something about yourself?",
      timestamp: "",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Database states
  const [userDbId, setUserDbId] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [currentConversationType, setCurrentConversationType] = useState<string | null>(null);
  const [creditsError, setCreditsError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Handle post-signup/signin pending message recovery
  useEffect(() => {
    if (authLoaded && userId) {
      const pendingMsg = localStorage.getItem("backstage_pending_msg");
      if (pendingMsg) {
        localStorage.removeItem("backstage_pending_msg");
        // Append user message
        const userMsgId = Date.now().toString();
        const newMsg: Message = {
          id: userMsgId,
          sender: "user",
          text: pendingMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, newMsg]);
      }
    }
  }, [authLoaded, userId]);

  // Sync authenticated Clerk user to Supabase
  useEffect(() => {
    if (authLoaded && userId && userLoaded && user) {
      syncUser()
        .then((res) => {
          if (res.success && res.user) {
            setUserDbId(res.user.id);
            setCredits(res.user.credits);
            setCurrentConversationType(res.user.current_conversation_type);
          } else {
            console.error("Failed to sync user to Supabase:", res.error);
          }
        })
        .catch((err) => {
          console.error("Error invoking syncUser server action:", err);
        });
    }
  }, [authLoaded, userId, userLoaded, user]);

  // Load messages once we have the database user ID
  useEffect(() => {
    if (userDbId) {
      getMessages(userDbId)
        .then((res) => {
          if (res.success && res.messages) {
            const formatted: Message[] = res.messages.map((m: any) => ({
              id: String(m.id),
              sender: (m.sender_type === "user" ? "user" : "Harnoor") as "user" | "Harnoor",
              text: m.message_text,
              timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }));
            if (formatted.length > 0) {
              setMessages(formatted);
            }
          } else {
            console.error("Failed to load messages:", res.error);
          }
        })
        .catch((err) => {
          console.error("Error fetching message history:", err);
        });
    }
  }, [userDbId]);

  // Handle landing page form submit (signed out)
  const handleLandingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!landingInput.trim()) return;

    // Save pending message and launch Clerk sign in modal directly
    localStorage.setItem("backstage_pending_msg", landingInput);
    clerk.openSignIn();
  };

  // Handle message window form submit (signed in)
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !userDbId) return;

    // Check credits before sending
    if (credits !== null && credits <= 0) {
      setCreditsError("You have 0 credits. Message sending is blocked!");
      return;
    }
    setCreditsError(null);

    const userText = input;
    setInput("");

    // Optimistically update the UI with user's message
    const tempUserMsgId = "temp-" + Date.now();
    const userMsg: Message = {
      id: tempUserMsgId,
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await sendMessageAction(userDbId, userText);
      if (res.success) {
        // Update credits state
        if (res.updatedCredits !== undefined) {
          setCredits(res.updatedCredits);
        }

        // Simulate typing delay for bot response
        setTimeout(() => {
          setIsTyping(false);
          const replyMsgId = "reply-" + Date.now();
          setMessages((prev) => [
            ...prev,
            {
              id: replyMsgId,
              sender: "Harnoor",
              text: res.botReply || "",
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }, res.delayMs || 1500);
      } else {
        setIsTyping(false);
        setCreditsError(res.error || "Failed to send message");
        // Remove optimistic user message if it failed
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId));
      }
    } catch (err: any) {
      setIsTyping(false);
      setCreditsError(err.message || "Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId));
    }
  };

  // Check if we should render the signed-in Message Window directly
  const showMessageWindowDirectly = authLoaded && userId;

  if (showMessageWindowDirectly) {
    return (
      <main
        className="w-full h-[calc(100vh-4rem)] bg-[#FAF8F5] text-stone-900 dark:bg-[#070707] dark:text-stone-100 flex flex-col"
        data-conversation-type={currentConversationType ?? undefined}
      >
        {/* Full Screen Chat Sandbox / Message Window */}
        <div className="relative w-full h-full bg-white dark:bg-[#0f0f0f] flex flex-col justify-between">
          {/* Contact Status Bar */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-stone-100 dark:border-stone-900 bg-stone-50/20 dark:bg-black/20">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border border-stone-200 dark:border-stone-850">
                <div className="w-full h-full bg-[#8f6d3d]/10 text-[#8f6d3d] flex items-center justify-center font-semibold text-sm">
                  HV
                </div>
              </div>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-sm tracking-wide text-stone-950 dark:text-stone-50">Harnoor V.</span>
                <span className="text-[10px] text-[#8f6d3d] font-semibold tracking-wider uppercase">Online hour ago</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-widest font-semibold">Credits</span>
              <span className={`text-sm font-semibold tracking-wide ${credits !== null && credits > 0 ? "text-[#8f6d3d]" : "text-red-500 animate-pulse"}`}>
                {credits !== null ? credits : "..."}
              </span>
            </div>
          </div>

          {/* Message List - Full Screen Height */}
          <div className="flex-1 overflow-y-auto py-6 px-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === "user" ? "items-end" : "items-start"
                } space-y-1`}
              >
                <div
                  className={`px-4 py-3 rounded-2xl max-w-[70%] text-sm shadow-sm leading-relaxed text-left ${
                    msg.sender === "user"
                      ? "bg-[#8f6d3d] text-white rounded-tr-sm"
                      : "bg-stone-100 text-stone-900 dark:bg-stone-900 dark:text-stone-100 rounded-tl-sm"
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-stone-400 px-1 uppercase tracking-wider">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex flex-col items-start space-y-1">
                <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-900 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-[#8f6d3d] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-[#8f6d3d] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-[#8f6d3d] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Active Message Input Form */}
          <form onSubmit={handleSend} className="p-6 border-t border-stone-100 dark:border-stone-900 bg-white dark:bg-[#0f0f0f]">
            {creditsError && (
              <div className="mb-3 text-xs text-red-600 dark:text-red-400 font-semibold px-4 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 rounded-2xl text-center">
                {creditsError}
              </div>
            )}
            <div className="flex items-center bg-stone-50 dark:bg-stone-950 rounded-full px-4 py-2 border border-stone-200 dark:border-stone-900">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-none text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-0 text-sm py-1.5 placeholder-stone-400 dark:placeholder-stone-600"
              />
              <button
                type="submit"
                className={`p-2 rounded-full transition-all duration-200 active:scale-90 cursor-pointer ${
                  input.trim()
                    ? "bg-[#8f6d3d] text-white shadow-sm"
                    : "text-stone-300 dark:text-stone-700"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 transform rotate-45 -translate-x-[1px] translate-y-[1px]">
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  // --- SIGNED OUT: LANDING PAGE MODE (DEFAULT FALLBACK) ---
  return (
    <main className="flex flex-col items-center justify-between min-h-[calc(100vh-4rem)] bg-[#FAF8F5] text-stone-900 dark:bg-[#070707] dark:text-stone-100">
      
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-16 pb-12 max-w-4xl w-full">
        <span className="text-xs uppercase tracking-[0.25em] text-[#8f6d3d] dark:text-[#c4a06d] font-semibold mb-2">
          Send me a message
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight text-stone-950 dark:text-stone-50 max-w-3xl leading-[1.15] mb-1">
          Will reply soon...
        </h1>
  
      </section>

      {/* Landing Page Mockup Chat Sandbox */}
      <section className="w-full max-w-md px-4 pb-2">
        <div className="relative rounded-[2.5rem] p-2 bg-white dark:bg-[#0f0f0f] border border-stone-200/60 dark:border-stone-900 shadow-xl overflow-hidden min-h-[10px] flex flex-col justify-between">
          
          {/* Header notch */}
          <div className="flex justify-between items-center px-4 pb-3 border-b border-stone-100 dark:border-stone-900">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border border-stone-200 dark:border-stone-850 bg-[#8f6d3d]/10 text-[#8f6d3d] flex items-center justify-center font-semibold text-sm">
                HV
              </div>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-sm tracking-wide text-stone-950 dark:text-stone-50">Harnoor V.</span>
                <span className="text-[10px] text-[#8f6d3d] font-semibold tracking-wider uppercase">Online hour ago</span>
              </div>
            </div>
          </div>

          {/* Chat List (just initial greeting message) */}
          <div className="flex-1 overflow-y-auto py-1 px-2 space-y-4 max-h-[360px] min-h-[300px]">
            <div className="flex flex-col items-start space-y-1">
              <div className="px-4 py-3 rounded-2xl max-w-[80%] text-sm shadow-sm leading-relaxed text-left bg-stone-100 text-stone-900 dark:bg-stone-900 dark:text-stone-100 rounded-tl-sm">
                Hi tell me something about yourself?
              </div>
              <span className="text-[9px] text-stone-400 px-1 uppercase tracking-wider">ONLINE hour ago</span>
            </div>
            <div ref={messagesEndRef} />
          </div>

          {/* Form intercepts click to open Clerk modal directly */}
          <form onSubmit={handleLandingSubmit} className="relative pt-3 border-t border-stone-100 dark:border-stone-900">
            <div className="absolute -top-7 left-0 right-0 bg-[#fbf5eb] dark:bg-[#201b13] border-y border-[#8f6d3d]/20 py-1.5 px-4 text-center">
              <span className="text-[10px] sm:text-xs font-serif text-[#8f6d3d] dark:text-[#c4a06d] tracking-wide font-medium">
                Send your first message after signing up.
              </span>
            </div>
            <div className="flex items-center bg-stone-50 dark:bg-stone-950 rounded-full px-4 py-2 border border-stone-200 dark:border-stone-900">
              <input
                type="text"
                value={landingInput}
                onChange={(e) => setLandingInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-none text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-0 text-sm py-1.5 placeholder-stone-400 dark:placeholder-stone-600"
              />
              <button
                type="submit"
                className={`p-2 rounded-full transition-all duration-200 active:scale-90 cursor-pointer ${
                  landingInput.trim()
                    ? "bg-[#8f6d3d] text-white shadow-sm"
                    : "text-stone-300 dark:text-stone-700"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 transform rotate-45 -translate-x-[1px] translate-y-[1px]">
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="w-full bg-[#FAF8F5] dark:bg-[#070707] py-12 px-6 border-t border-stone-200/30 dark:border-stone-900/30 flex flex-col items-center justify-center">
        <div className="font-serif tracking-[0.2em] text-[#8f6d3d] dark:text-[#c4a06d] text-xs font-semibold mb-6">
          BACKSTAGE CHAT.ME
        </div>
        <div className="flex gap-6 text-xs text-stone-500 dark:text-stone-400 mb-8">
          <a href="#" className="hover:text-stone-800 dark:hover:text-stone-100">Terms of Service</a>
          <a href="#" className="hover:text-stone-800 dark:hover:text-stone-100">Privacy Policy</a>
          <a href="#" className="hover:text-stone-800 dark:hover:text-stone-100">Cookie Policy</a>
          <a href="#" className="hover:text-stone-800 dark:hover:text-stone-100">Support</a>
        </div>
        <p className="text-[10px] text-stone-400 dark:text-stone-600 uppercase tracking-widest">
          © 2026 BACKSTAGE ACCESS. ALL RIGHTS RESERVED.
        </p>
      </footer>
    </main>
  );
}
