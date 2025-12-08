"use client";

import React, { useState, useEffect, useRef } from "react";
import { useChat } from "@/hooks/useChat";

interface ChatWindowProps {
  conversationId: string | null;
  isNewConversation: boolean;
  onAutoNewConversation: () => void;
  refreshConversationList: () => void;
  onBack: () => void;
  isMobile: boolean;
  selectedConversationName?: string;
}

export default function ChatWindow({
  conversationId,
  isNewConversation,
  onAutoNewConversation,
  refreshConversationList,
  onBack,
  isMobile,
  selectedConversationName,
}: ChatWindowProps) {
  const { messages, isLoading, sendMessage } = useChat({
    conversationId,
    isNewConversation,
  });

  const [input, setInput] = useState("");
  const [optimisticMessage, setOptimisticMessage] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // If a new conversation is created, send any "optimistic" message
  useEffect(() => {
    if (conversationId && optimisticMessage) {
      (async () => {
        await sendMessage(optimisticMessage);
        setOptimisticMessage("");
        setIsCreating(false);
        if (isNewConversation) {
          refreshConversationList();
        }
      })();
    }
  }, [
    conversationId,
    optimisticMessage,
    sendMessage,
    isNewConversation,
    refreshConversationList,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (!conversationId) {
      // Create conversation, then send first message
      setOptimisticMessage(input);
      setIsCreating(true);
      onAutoNewConversation();
    } else {
      // Otherwise, just send the message
      sendMessage(input);
    }
    setInput("");
  };

  // Decide which messages to display
  const displayMessages = conversationId
    ? messages
    : optimisticMessage
    ? [
        { type: "user", content: optimisticMessage },
        { type: "ai", content: "در حال ایجاد گفتگوی جدید..." },
      ]
    : isCreating
    ? [{ type: "ai", content: "در حال ایجاد گفتگوی جدید..." }]
    : [];

  return (
    // RTL so Persian text reads right-to-left
    <div className="flex flex-col h-full" dir="rtl">
      {/* Mobile Header: forced LTR so the back arrow is on the left */}
      {isMobile && (
        <div
          className="flex items-center p-4 border-b"
          dir="ltr"
          style={{ background: "var(--card-background)" }}
        >
          <button
            onClick={onBack}
            className="mr-4 text-blue-500 hover:text-blue-700"
          >
            ← بازگشت
          </button>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {selectedConversationName || "گفتگوی جدید"}
          </h2>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 p-4 overflow-y-auto"
        style={{ background: "var(--card-background)" }}
      >
        {displayMessages.map((message, i) => {
          const isUser = message.type === "user";
          return (
            <div
              key={i}
              // Float user messages to the right, AI messages to the left
              className={`relative mb-4 p-4 rounded-md max-w-[70%] ${
                isUser
                  ? // User: right side
                    "ml-auto text-right bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  : // AI: left side
                    "mr-auto text-left bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
              }`}
            >
              {message.content}
            </div>
          );
        })}

        {isLoading && (
          <div className="text-center p-2 text-gray-500">در حال بارگذاری...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area: Send button on the right */}
      <div
        className="p-4 border-t"
        style={{ background: "var(--card-background)" }}
      >
        {/* LTR so the input is on the left, button on the right */}
        <form onSubmit={handleSubmit} className="flex" dir="ltr">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 p-3 text-base border rounded-l-lg outline-none"
            style={{
              background: "var(--input-background)",
              borderColor: "var(--input-border)",
              color: "var(--input-text)",
            }}
            placeholder="پیام خود را اینجا تایپ کنید..."
            disabled={isLoading}
          />
          <button
            type="submit"
            className="px-5 py-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            ارسال
          </button>
        </form>
      </div>
    </div>
  );
}
