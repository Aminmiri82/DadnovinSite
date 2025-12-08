"use client";

import React, { useEffect, useRef } from "react";

interface Conversation {
  conversationId: string;
  name: string;
  createdAt: string;
}

interface ConversationListProps {
  conversationList: Conversation[];
  selectedConversation: string | null;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  isMobile: boolean;
}

export default function ConversationList({
  conversationList,
  selectedConversation,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  isMobile,
}: ConversationListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when conversations change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [conversationList]);

  return (
    <div
      dir="ltr"
      className={`${
        isMobile ? "w-full h-full" : "w-1/4"
      } flex flex-col border-r`}
      style={{ background: "var(--card-background)" }}
    >
      {/* Header in RTL */}
      <div dir="rtl" className="border-b">
        <h2
          className="text-lg sm:text-xl font-bold p-4"
          style={{ color: "var(--foreground)" }}
        >
          لیست گفتگوها
        </h2>
      </div>

      {/* Scrollable conversation list (LTR) */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-4"
        style={{ color: "var(--foreground)", maxHeight: "100vh" }}
      >
        {conversationList.map((conv) => (
          <div
            key={conv.conversationId}
            className={`flex justify-between items-center p-2 mb-2 rounded cursor-pointer hover:bg-opacity-10 hover:bg-gray-300 ${
              selectedConversation === conv.conversationId
                ? "bg-[var(--selection-background,rgba(59,130,246,0.1))]"
                : ""
            }`}
            onClick={() => onSelectConversation(conv.conversationId)}
          >
            <div className="flex-grow mr-2">{conv.name}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConversation(conv.conversationId);
              }}
              className="text-red-500 hover:text-red-700 px-2"
              title="حذف"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* New Conversation Button (LTR) */}
      <div className="p-4 border-t">
        <div dir="rtl">
          <button
            onClick={onNewConversation}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm sm:text-base"
          >
            گفتگوی جدید
          </button>
        </div>
      </div>
    </div>
  );
}
