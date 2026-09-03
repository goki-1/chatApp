"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { syncUser, getMessages, sendMessageAction, markMessageAsRead, createCheckoutSession, getLastBotActiveTime } from "@/lib/actions";
import { CreditModal } from "@/components/CreditModal";
import { supabase } from "@/lib/supabase";

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
  let rawDateStr: string | null = lastBotCreatedAt;

  if (botMsgs.length > 0 && botMsgs[botMsgs.length - 1].createdAt) {
    const lastMsgTime = botMsgs[botMsgs.length - 1].createdAt!;
    if (!rawDateStr || new Date(lastMsgTime).getTime() > new Date(rawDateStr).getTime()) {
      rawDateStr = lastMsgTime;
    }
  }

  if (!rawDateStr) {  ``
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
      text: "Hello sir ji?",
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

  // Pagination states
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll messages into view when mobile keyboard resizes viewport
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const onViewportChange = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    window.visualViewport.addEventListener("resize", onViewportChange);
    window.visualViewport.addEventListener("scroll", onViewportChange);

    return () => {
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
    };
  }, []);

  // Stripe Payment & Refill Modal states
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  // Database active status timestamp for Harnoor
  const [lastBotCreatedAt, setLastBotCreatedAt] = useState<string | null>(null);

  // Trigger state to recalculate bot active status text locally in browser
  const [, setTimeTrigger] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTrigger(prev => prev + 1);
    }, 30000); // 30s interval for local UI timer text
    return () => clearInterval(interval);
  }, []);

  // Fetch Harnoor's latest message activity timestamp ONCE on page mount
  useEffect(() => {
    getLastBotActiveTime().then((res) => {
      if (res.success && res.createdAt) {
        setLastBotCreatedAt(res.createdAt);
      }
    });
  }, []);

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

  // Load initial 20 messages once we have the database user ID
  useEffect(() => {
    if (userDbId) {
      getMessages(userDbId, 20)
        .then((res) => {
          if (res.success && res.messages) {
            setHasMoreMessages(Boolean(res.hasMore));
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

  // Load earlier 20 messages when user clicks "Load earlier messages"
  const handleLoadEarlier = async () => {
    if (!userDbId || isLoadingEarlier || !hasMoreMessages) return;

    const oldestMsg = messages.find((m) => !isNaN(Number(m.id)));
    if (!oldestMsg) return;

    const beforeId = Number(oldestMsg.id);
    setIsLoadingEarlier(true);

    const container = scrollContainerRef.current;
    const oldScrollHeight = container ? container.scrollHeight : 0;

    try {
      const res = await getMessages(userDbId, 20, beforeId);
      if (res.success && res.messages) {
        setHasMoreMessages(Boolean(res.hasMore));
        const formattedEarlier: Message[] = res.messages.map((m: any) => ({
          id: String(m.id),
          sender: (m.sender_type === "user" ? "user" : "Harnoor") as "user" | "Harnoor",
          text: m.message_text,
          timestamp: new Date(m.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
          createdAt: m.created_at,
          status: m.is_read ? 'read' : 'delivered',
        }));

        setMessages((prev) => [...formattedEarlier, ...prev]);

        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - oldScrollHeight;
          }
        }, 50);
      }
    } catch (err) {
      console.error("Error loading earlier messages:", err);
    } finally {
      setIsLoadingEarlier(false);
    }
  };

  // Pure Supabase Realtime WebSocket subscription for incoming messages, read receipts, and ai_typing updates
  useEffect(() => {
    if (!userDbId) return;

    const channel = supabase
      .channel(`user-realtime-${userDbId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `user_id=eq.${userDbId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as any;
            if (newMsg && newMsg.sender_type !== "user") {
              setMessages((prev) => {
                if (prev.some((m) => m.id === String(newMsg.id))) return prev;
                return [
                  ...prev,
                  {
                    id: String(newMsg.id),
                    sender: (newMsg.sender_type === "user" ? "user" : "Harnoor") as "Harnoor" | "user",
                    text: newMsg.message_text,
                    timestamp: new Date(newMsg.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                    createdAt: newMsg.created_at,
                  },
                ];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedMsg = payload.new as any;
            if (updatedMsg && updatedMsg.sender_type === "user" && updatedMsg.is_read) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === String(updatedMsg.id) ? { ...msg, status: "read" } : msg
                )
              );
              setLastBotCreatedAt(new Date().toISOString());
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
          filter: `id=eq.${userDbId}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (record && typeof record.ai_typing === "boolean") {
            setIsTyping(record.ai_typing);
          }
          if (record && typeof record.credits === "number") {
            setCredits(record.credits);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleCheckout = async (creditsTier: 50 | 100 | 200, currencyCode: string = "usd") => {
    if (!userDbId) return;
    setIsCheckoutLoading(true);
    try {
      const currentUrl = window.location.origin + window.location.pathname;
      const res = await createCheckoutSession(userDbId, creditsTier, currentUrl, currencyCode);
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
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

    // Keep focus so the mobile keyboard never dismisses on send!
    inputRef.current?.focus();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

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
      } else {
        setCreditsError(res.error || "Failed to send message");
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId));
      }
    } catch (err: any) {
      setCreditsError(err.message || "Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId));
    }
  };

  // Signed Out View for Harnoor's promo link
  if (authLoaded && !userId) {
    const status = getBotStatus(messages, lastBotCreatedAt);
    return (
      <main className="relative w-full min-h-[calc(100vh-4rem)] bg-[#F5F2EB] dark:bg-[#050505] text-stone-900 dark:text-stone-100 flex items-start justify-center p-4 sm:p-6 pt-4 sm:pt-8 overflow-hidden">
        {/* Apple-Style Glassmorphic Studio Mesh Backdrop */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-[#8f6d3d]/50 via-[#c4a06d]/35 to-amber-500/20 dark:from-[#8f6d3d]/40 dark:via-[#c4a06d]/25 dark:to-[#3a2712]/60 blur-[100px] animate-pulse" />
          <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#c4a06d]/40 via-[#8f6d3d]/30 to-amber-600/20 dark:from-[#3a2712]/50 dark:to-[#1a1208]/70 blur-[90px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-[#8f6d3d]/25 dark:bg-[#8f6d3d]/15 blur-[80px]" />
          {/* Subtle Grid Texture */}
          <div className="absolute inset-0 bg-[radial-gradient(#8f6d3d_1px,transparent_1px)] dark:bg-[radial-gradient(#c4a06d_1px,transparent_1px)] [background-size:24px_24px] opacity-15 dark:opacity-10" />
        </div>

        {/* Centered Compact Chat Card */}
        <div className="relative z-10 max-w-md w-full bg-white/70 dark:bg-[#121212]/70 border-2 border-stone-300 dark:border-[#c4a06d]/50 rounded-3xl shadow-[0_0_35px_rgba(196,160,109,0.2)] backdrop-blur-2xl overflow-hidden flex flex-col min-h-[480px] sm:min-h-[540px]">
          {/* Card Header / Creator Profile */}
          <div className="relative px-6 pt-6 pb-4 bg-stone-50/40 dark:bg-black/30">

            <div className="flex flex-col items-center text-center space-y-2">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#8f6d3d]/60 bg-[#8f6d3d]/10 flex items-center justify-center shadow-md">
                <img src="/harnoor.jpg" alt="Harnoor K." className="w-full h-full object-cover object-top" />
              </div>
              <div>
                <h2 className="font-serif font-medium text-lg text-stone-950 dark:text-stone-50">Harnoor K.</h2>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  {status.isOnline && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  )}
                  <span className="text-[10px] text-[#8f6d3d] dark:text-[#c4a06d] font-semibold tracking-wider uppercase">
                    {status.text}
                  </span>
                </div>
              </div>
              <p className="text-sm sm:text-base text-[#8f6d3d] dark:text-[#c4a06d] font-medium italic pt-1">
                Chat for FREE
              </p>
              <p className="text-sm sm:text-base text-[#8f6d3d] dark:text-[#c4a06d] font-medium italic pt-1">
                ✨ I will reply in 1 minute ...
              </p>
            </div>
          </div>

          {/* Sample Chat Preview Area */}
          <div className="flex-1 p-6 space-y-4 min-h-[200px] sm:min-h-[260px] overflow-y-auto bg-stone-50/30 dark:bg-black/20">
            <div className="flex flex-col items-start space-y-1">
              <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-none bg-stone-200/90 text-stone-900 dark:bg-stone-800/95 dark:text-stone-50 text-xs sm:text-sm leading-relaxed border border-stone-300 dark:border-stone-700/80 shadow-xs font-medium">
                Hello sir ji ?
              </div>
            </div>
          </div>

          {/* Compact Guest Input Form */}
          <form onSubmit={handleLandingSubmit} autoComplete="off" data-form-type="other" className="p-4 sm:p-5 bg-white/90 dark:bg-[#121212]/90">
            <div className="flex items-center bg-stone-100/90 dark:bg-stone-900/90 rounded-full px-4 py-2.5 border-2 border-[#8f6d3d]/70 dark:border-[#c4a06d]/80 focus-within:border-[#8f6d3d] dark:focus-within:border-[#c4a06d] focus-within:ring-4 focus-within:ring-[#8f6d3d]/30 shadow-[0_0_15px_rgba(196,160,109,0.2)] transition-all">
              <input
                type="text"
                name="guest_chat_message"
                id="guest-chat-message-input"
                autoComplete="off"
                autoCorrect="on"
                autoCapitalize="sentences"
                spellCheck="true"
                enterKeyHint="send"
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
                aria-autocomplete="none"
                value={landingInput}
                onChange={(e) => setLandingInput(e.target.value)}
                placeholder="Type your message to Harnoor..."
                className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-stone-800 dark:text-stone-100 focus:placeholder-transparent placeholder-stone-400 px-1"
              />
              <button
                type="submit"
                disabled={!landingInput.trim()}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#9e7a44] via-[#b59052] to-[#d4af37] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 shadow-md shadow-[#9e7a44]/40 hover:shadow-lg cursor-pointer ml-1.5 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-4.5 sm:h-4.5 -rotate-45 translate-x-[1px] -translate-y-[1px] text-white filter drop-shadow-md">
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
      className="relative w-full flex-1 min-h-0 bg-[#F5F2EB] dark:bg-[#050505] text-stone-900 dark:text-stone-100 flex flex-col overflow-hidden overscroll-none"
      data-conversation-type={currentConversationType ?? undefined}
    >
      {/* Apple-Style Glassmorphic Studio Mesh Backdrop */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-[#8f6d3d]/45 via-[#c4a06d]/30 to-amber-500/20 dark:from-[#8f6d3d]/35 dark:via-[#c4a06d]/20 dark:to-[#3a2712]/50 blur-[100px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#c4a06d]/35 via-[#8f6d3d]/25 to-amber-600/15 dark:from-[#3a2712]/45 dark:to-[#1a1208]/60 blur-[90px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-[#8f6d3d]/20 dark:bg-[#8f6d3d]/10 blur-[80px]" />
        {/* Subtle Grid Texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#8f6d3d_1px,transparent_1px)] dark:bg-[radial-gradient(#c4a06d_1px,transparent_1px)] [background-size:24px_24px] opacity-15 dark:opacity-10" />
      </div>

      {/* Full Screen Chat Sandbox / Message Window */}
      <div className="relative z-10 w-full h-full bg-white/60 dark:bg-[#0c0c0c]/60 backdrop-blur-2xl flex flex-col justify-between overflow-hidden">
        {/* Contact Status Bar */}
        <div className="shrink-0 flex justify-between items-center px-4 sm:px-6 py-2 sm:py-3 border-b border-stone-100 dark:border-stone-900 bg-stone-50/40 dark:bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-stone-200 dark:border-stone-850">
              <img src="/harnoor.jpg" alt="Harnoor K." className="w-full h-full object-cover object-top" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-sm tracking-wide text-stone-950 dark:text-stone-50">Harnoor K.</span>
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

        {/* Message List - Dynamic Scrollable */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-3 px-2.5 sm:px-5 space-y-2.5">
          {hasMoreMessages && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={handleLoadEarlier}
                disabled={isLoadingEarlier}
                className="text-xs text-[#8f6d3d] hover:text-[#7a5c32] dark:text-[#c4a06d] bg-stone-100/90 dark:bg-stone-900/80 border border-stone-200/80 dark:border-stone-800/80 px-4 py-1.5 rounded-full shadow-xs disabled:opacity-50 font-medium transition-all cursor-pointer"
              >
                {isLoadingEarlier ? "Loading earlier messages..." : "Load earlier messages"}
              </button>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[82%] sm:max-w-[75%] px-3 pt-1.5 pb-1.5 rounded-2xl text-[14.5px] sm:text-[15px] leading-snug break-words ${
                  msg.sender === "user"
                    ? "bg-[#8f6d3d] text-white rounded-br-xs shadow-xs"
                    : "bg-stone-200/90 text-stone-900 dark:bg-stone-800/95 dark:text-stone-50 rounded-bl-xs border border-stone-300/80 dark:border-stone-700/80 shadow-xs font-medium"
                }`}
              >
                <span>{msg.text}</span>
                <span className="inline-flex items-center gap-0.5 float-right ml-2.5 mt-2.5 -mb-0.5 select-none shrink-0">
                  {msg.timestamp && (
                    <span
                      className={`text-[8px] sm:text-[8.5px] tracking-tight leading-none ${
                        msg.sender === "user"
                          ? "text-amber-100/70"
                          : "text-stone-500 dark:text-stone-400"
                      }`}
                    >
                      {msg.timestamp.replace(/\s+/g, "\u2009")}
                    </span>
                  )}
                  {/* Ticks for user messages */}
                  {msg.sender === "user" && msg.status && (
                    <span className="leading-none inline-flex items-center ml-0.5 text-[7.5px] sm:text-[8px]">
                      {msg.status === "sent" && (
                        <span className="text-amber-100/70" title="Sent">✓</span>
                      )}
                      {msg.status === "delivered" && (
                        <span className="text-amber-100/90 font-bold" title="Delivered">✓✓</span>
                      )}
                      {msg.status === "read" && (
                        <span className="text-sky-300 font-bold" title="Read">✓✓</span>
                      )}
                    </span>
                  )}
                </span>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex flex-col items-start space-y-1">
              <div className="bg-stone-100/90 dark:bg-stone-900/80 border border-stone-200/60 dark:border-stone-800/60 px-4 py-3 rounded-2xl rounded-bl-none flex items-center space-x-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Active Message Input Form */}
        <form
          onSubmit={handleSend}
          autoComplete="off"
          data-form-type="other"
          className="shrink-0 p-2.5 sm:p-4 border-t border-stone-100 dark:border-stone-900 bg-white/95 dark:bg-[#0f0f0f]/95 backdrop-blur-md pb-[max(0.6rem,env(safe-area-inset-bottom))]"
        >
          {paymentNotice && (
            <div className="mb-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl flex justify-between items-center">
              <span>{paymentNotice}</span>
              <button type="button" onClick={() => setPaymentNotice(null)} className="text-emerald-500 hover:text-emerald-700 ml-2">✕</button>
            </div>
          )}
          {creditsError && (
            <div className="mb-2 text-xs text-red-600 dark:text-red-400 font-semibold px-3.5 py-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 rounded-2xl text-center flex justify-between items-center">
              <span>{creditsError}</span>
              <button type="button" onClick={() => setIsCreditModalOpen(true)} className="underline text-[#8f6d3d] font-bold ml-2">Refill Now</button>
            </div>
          )}
          <div className="flex items-center bg-stone-100/90 dark:bg-stone-900/90 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 border-2 border-[#8f6d3d]/70 dark:border-[#c4a06d]/80 focus-within:border-[#8f6d3d] dark:focus-within:border-[#c4a06d] focus-within:ring-4 focus-within:ring-[#8f6d3d]/30 shadow-[0_0_15px_rgba(196,160,109,0.2)] transition-all">
            <textarea
              ref={inputRef as any}
              rows={1}
              name="chat_message"
              id="chat-message-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your message..."
              autoComplete="off"
              autoCorrect="on"
              autoCapitalize="sentences"
              spellCheck={true}
              enterKeyHint="send"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              aria-autocomplete="none"
              className="flex-1 bg-transparent border-none outline-none text-sm text-stone-800 dark:text-stone-100 focus:placeholder-transparent placeholder-stone-400 px-2 resize-none max-h-24 py-1 leading-normal"
            />
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onTouchEnd={(e) => {
                e.preventDefault();
                if (input.trim()) {
                  handleSend();
                }
              }}
              onClick={(e) => {
                e.preventDefault();
                if (input.trim()) {
                  handleSend();
                }
              }}
              aria-label="Send message"
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#9e7a44] via-[#b59052] to-[#d4af37] text-white flex items-center justify-center transition-all duration-200 shadow-md shadow-[#9e7a44]/40 hover:shadow-lg ml-1.5 shrink-0 ${
                !input.trim()
                  ? "opacity-30 cursor-not-allowed pointer-events-none"
                  : "hover:scale-105 active:scale-95 cursor-pointer"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-4.5 sm:h-4.5 -rotate-45 translate-x-[1px] -translate-y-[1px] text-white filter drop-shadow-md">
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
