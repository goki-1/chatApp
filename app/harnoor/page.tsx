"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { syncUser, getMessages, sendMessageAction, markMessageAsRead, createCheckoutSession, getLastBotActiveTime } from "@/lib/actions";
import { CreditModal } from "@/components/CreditModal";

interface Message {
  id: string;
  sender: "Harnoor" | "user";
  text: string;
  timestamp: string;
  createdAt?: string;
  status?: "sent" | "delivered" | "read";
}

function getBotStatus(messagesList: Message[], lastBotCreatedAt: string | null = null) {
  const botMsgs = messagesList.filter(m => m.sender === "Harnoor" && m.createdAt);
  let rawDateStr: string | null = null;

  if (botMsgs.length > 0 && botMsgs[botMsgs.length - 1].createdAt) {
    rawDateStr = botMsgs[botMsgs.length - 1].createdAt!;
  } else if (lastBotCreatedAt) {
    rawDateStr = lastBotCreatedAt;
  }

  if (!rawDateStr) {
    return { text: "Online", isOnline: true };
  }

  const lastActive = new Date(rawDateStr);
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return { text: "Online", isOnline: true };
  } else if (diffMins < 60) {
    return { text: `Active ${diffMins}m ago`, isOnline: false };
  } else {
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return { text: `Active ${diffHours}h ago`, isOnline: false };
    } else if (diffHours < 48) {
      return { text: "Active yesterday", isOnline: false };
    } else {
      const formattedDate = lastActive.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { text: `Active ${formattedDate}`, isOnline: false };
    }
  }
}

export default function HarnoorPage() {
  const { isLoaded: authLoaded, userId } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  const clerk = useClerk();

  // Guest landing input state (signed out)
  const [landingInput, setLandingInput] = useState("");

  // Authenticated chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "Harnoor",
      text: "Hi! Tell me something about yourself?",
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

  // Stripe Payment & Refill Modal states
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  // Database active status timestamp for Harnoor
  const [lastBotCreatedAt, setLastBotCreatedAt] = useState<string | null>(null);

  // Trigger state to recalculate bot active status periodically
  const [timeTrigger, setTimeTrigger] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTrigger(prev => prev + 1);
    }, 15000); // 15s interval
    return () => clearInterval(interval);
  }, []);

  // Fetch Harnoor's latest message activity timestamp across database
  useEffect(() => {
    getLastBotActiveTime().then((res) => {
      if (res.success && res.createdAt) {
        setLastBotCreatedAt(res.createdAt);
      }
    });
  }, [timeTrigger]);

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
        const userMsgId = Date.now().toString();
        const newMsg: Message = {
          id: userMsgId,
          sender: "user",
          text: pendingMsg,
          timestamp: new Date().toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
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
              timestamp: new Date(m.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
              createdAt: m.created_at,
              status: m.is_read ? 'read' : 'delivered',
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

  // Handle Stripe Payment redirect status
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get("payment");

      if (paymentStatus === "success") {
        setPaymentNotice("Payment successful! Your credits have been updated.");
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
        if (authLoaded && userId && userLoaded && user) {
          syncUser().then((res) => {
            if (res.success && res.user) {
              setCredits(res.user.credits);
            }
          });
        }
      } else if (paymentStatus === "cancelled") {
        setPaymentNotice("Payment was cancelled.");
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [authLoaded, userId, userLoaded, user]);

  const handleCheckout = async (creditsTier: 50 | 100 | 200, currencyCode: string = "cad") => {
    if (!userDbId) return;
    setIsCheckoutLoading(true);
    try {
      const res = await createCheckoutSession(userDbId, creditsTier, window.location.origin, currencyCode);
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        setCreditsError(res.error || "Failed to initiate Stripe checkout");
        setIsCheckoutLoading(false);
      }
    } catch (err: any) {
      setCreditsError(err.message || "Checkout error occurred");
      setIsCheckoutLoading(false);
    }
  };

  // Handle landing page guest submit (signed out)
  const handleLandingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!landingInput.trim()) return;

    localStorage.setItem("backstage_pending_msg", landingInput);
    clerk.openSignIn();
  };

  // Handle message window form submit (signed in)
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !userDbId) return;

    // Check credits before sending
    if (credits !== null && credits <= 0) {
      setCreditsError("You have 0 credits. Please refill to continue messaging.");
      setIsCreditModalOpen(true);
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
      timestamp: new Date().toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      status: 'sent',
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await sendMessageAction(userDbId, userText);
      if (res.success) {
        if (res.updatedCredits !== undefined) {
          setCredits(res.updatedCredits);
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempUserMsgId
              ? {
                  ...msg,
                  id: String(res.userMsgId),
                  createdAt: res.userMsgCreatedAt,
                  status: 'delivered',
                }
              : msg
          )
        );

        const dbMsgId = res.userMsgId;
        setTimeout(async () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === String(dbMsgId) ? { ...msg, status: 'read' } : msg
            )
          );
          if (dbMsgId) {
            await markMessageAsRead(dbMsgId);
          }
        }, 1000);

        setTimeout(() => {
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: String(res.botMsgId || "reply-" + Date.now()),
              sender: "Harnoor",
              text: res.botReply || "",
              timestamp: new Date(res.botMsgCreatedAt || Date.now()).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
              createdAt: res.botMsgCreatedAt || new Date().toISOString(),
            },
          ]);
        }, res.delayMs || 1500);
      } else {
        setIsTyping(false);
        setCreditsError(res.error || "Failed to send message");
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId));
      }
    } catch (err: any) {
      setIsTyping(false);
      setCreditsError(err.message || "Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId));
    }
  };

  // Signed Out View for Harnoor's promo link
  if (authLoaded && !userId) {
    const status = getBotStatus(messages, lastBotCreatedAt);
    return (
      <main className="relative w-full min-h-[calc(100vh-4rem)] bg-[#FAF8F5] text-stone-900 dark:bg-[#070707] dark:text-stone-100 flex items-start justify-center p-4 sm:p-6 pt-4 sm:pt-8 overflow-hidden">
        {/* Background Ambient Backdrop with Photo Accent */}
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-30 dark:opacity-20 pointer-events-none blur-3xl scale-125">
          <img src="/harnoor.jpg" alt="" className="w-96 h-96 object-cover object-top rounded-full" />
        </div>

        {/* Centered Compact Chat Card */}
        <div className="relative z-10 max-w-md w-full bg-white/95 dark:bg-[#121212]/95 border border-stone-200/80 dark:border-stone-850 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col min-h-[480px] sm:min-h-[540px]">
          {/* Card Header / Creator Profile */}
          <div className="relative px-6 pt-6 pb-4 bg-stone-50/40 dark:bg-black/30">

            <div className="flex flex-col items-center text-center space-y-2">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#8f6d3d]/40 bg-[#8f6d3d]/10 flex items-center justify-center shadow-md">
                <img src="/harnoor.jpg" alt="Harnoor V." className="w-full h-full object-cover object-top" />
              </div>
              <div>
                <h2 className="font-serif font-medium text-lg text-stone-950 dark:text-stone-50">Harnoor V.</h2>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  {status.isOnline && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  )}
                  <span className="text-[10px] text-[#8f6d3d] font-semibold tracking-wider uppercase">
                    {status.text}
                  </span>
                </div>
              </div>
              <p className="text-sm sm:text-base text-[#8f6d3d] dark:text-[#c4a06d] font-medium italic pt-1">
                ✨ Send a message, I will reply soon...
              </p>
            </div>
          </div>

          {/* Sample Chat Preview Area */}
          <div className="flex-1 p-6 space-y-4 min-h-[200px] sm:min-h-[260px] overflow-y-auto bg-stone-50/20 dark:bg-black/10">
            <div className="flex flex-col items-start space-y-1">
              <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-none bg-stone-100 text-stone-800 dark:bg-stone-900 dark:text-stone-200 text-xs sm:text-sm leading-relaxed shadow-sm">
                Hi! Tell me something about yourself?
              </div>
            </div>
          </div>

          {/* Compact Guest Input Form */}
          <form onSubmit={handleLandingSubmit} className="p-4 sm:p-5 bg-white dark:bg-[#121212]">
            <div className="flex items-center bg-stone-50 dark:bg-stone-950 rounded-full px-4 py-2 border border-stone-200 dark:border-stone-900 shadow-sm focus-within:border-[#8f6d3d] transition-colors">
              <input
                type="text"
                value={landingInput}
                onChange={(e) => setLandingInput(e.target.value)}
                placeholder="Type your message to Harnoor..."
                className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-stone-800 dark:text-stone-100 focus:placeholder-transparent placeholder-stone-400 px-1"
              />
              <button
                type="submit"
                disabled={!landingInput.trim()}
                className="w-8 h-8 rounded-full bg-[#8f6d3d] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:bg-[#7a5c32] active:scale-95 cursor-pointer ml-1 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 -rotate-45 translate-x-[1px] -translate-y-[1px]">
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.917H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.917a.75.75 0 0 0 .926.941l18-8a.75.75 0 0 0 0-1.382l-18-8Z" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-center text-stone-400 dark:text-stone-600 mt-2">
              Send your message to sign up.
            </p>
          </form>
        </div>
      </main>
    );
  }

  // Signed In Active Chat View
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
              <img src="/harnoor.jpg" alt="Harnoor V." className="w-full h-full object-cover object-top" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-sm tracking-wide text-stone-950 dark:text-stone-50">Harnoor V.</span>
              <div className="flex items-center gap-1">
                {getBotStatus(messages, lastBotCreatedAt).isOnline && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                )}
                <span className="text-[10px] text-[#8f6d3d] font-semibold tracking-wider uppercase">
                  {getBotStatus(messages, lastBotCreatedAt).text}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-widest font-semibold">Credits</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold tracking-wide ${credits !== null && credits > 0 ? "text-[#8f6d3d]" : "text-red-500 animate-pulse"}`}>
                {credits !== null ? credits : "..."}
              </span>
              <button
                onClick={() => setIsCreditModalOpen(true)}
                className="px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-[#8f6d3d] hover:bg-[#7a5c32] text-white transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
              >
                + Refill
              </button>
            </div>
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
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-[#8f6d3d] text-white rounded-br-none shadow-sm"
                    : "bg-stone-100 text-stone-800 dark:bg-stone-900 dark:text-stone-200 rounded-bl-none"
                }`}
              >
                {msg.text}
              </div>
              <div className="flex items-center gap-1">
                {msg.timestamp && (
                  <span className="text-[10px] text-stone-400 dark:text-stone-600 px-1 font-mono">
                    {msg.timestamp}
                  </span>
                )}
                {/* Ticks for user messages */}
                {msg.sender === "user" && msg.status && (
                  <span className="text-xs">
                    {msg.status === "sent" && (
                      <span className="text-stone-400" title="Sent">✓</span>
                    )}
                    {msg.status === "delivered" && (
                      <span className="text-stone-400 font-bold" title="Delivered">✓✓</span>
                    )}
                    {msg.status === "read" && (
                      <span className="text-sky-500 font-bold" title="Read">✓✓</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex flex-col items-start space-y-1">
              <div className="bg-stone-100 dark:bg-stone-900 px-4 py-3 rounded-2xl rounded-bl-none flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Active Message Input Form */}
        <form onSubmit={handleSend} className="p-6 border-t border-stone-100 dark:border-stone-900 bg-white dark:bg-[#0f0f0f]">
          {paymentNotice && (
            <div className="mb-3 text-xs text-emerald-700 dark:text-emerald-300 font-medium px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl flex justify-between items-center">
              <span>{paymentNotice}</span>
              <button type="button" onClick={() => setPaymentNotice(null)} className="text-emerald-500 hover:text-emerald-700 ml-2">✕</button>
            </div>
          )}
          {creditsError && (
            <div className="mb-3 text-xs text-red-600 dark:text-red-400 font-semibold px-4 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 rounded-2xl text-center flex justify-between items-center">
              <span>{creditsError}</span>
              <button type="button" onClick={() => setIsCreditModalOpen(true)} className="underline text-[#8f6d3d] font-bold ml-2">Refill Now</button>
            </div>
          )}
          <div className="flex items-center bg-stone-50 dark:bg-stone-950 rounded-full px-4 py-2 border border-stone-200 dark:border-stone-900">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-stone-800 dark:text-stone-100 focus:placeholder-transparent placeholder-stone-400 px-2"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-8 h-8 rounded-full bg-[#8f6d3d] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:bg-[#7a5c32] active:scale-95 cursor-pointer ml-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 -rotate-45 translate-x-[1px] -translate-y-[1px]">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.917H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.917a.75.75 0 0 0 .926.941l18-8a.75.75 0 0 0 0-1.382l-18-8Z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      <CreditModal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        userDbId={userDbId}
        onCheckout={handleCheckout}
        isLoading={isCheckoutLoading}
        errorText={creditsError}
      />
    </main>
  );
}
