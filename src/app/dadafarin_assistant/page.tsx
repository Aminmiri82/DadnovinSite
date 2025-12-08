"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { v4 as uuidv4 } from "uuid";
import dynamic from "next/dynamic";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// Dynamically import components that use localStorage with SSR disabled
const ConversationList = dynamic(
  () => import("@/components/ConversationList"),
  {
    ssr: false,
  }
);

const ChatWindow = dynamic(() => import("@/components/ChatWindow"), {
  ssr: false,
});

export default function DadafarinAssistant() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [isNewConversation, setIsNewConversation] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [conversationList, setConversationList] = useState<any[]>([]);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [showChat, setShowChat] = useState(false);

  // Get token on client side
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);
  }, []);

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    if (user && token) {
      try {
        const res = await fetch("/api/conversations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setConversationList(data);
      } catch (error) {
        console.error("Error fetching conversation list:", error);
      }
    }
  }, [user, token]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Initialize conversation once we have conversationId + user + token
  useEffect(() => {
    if (currentConversationId && user && token) {
      fetch("/api/assistant/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId: currentConversationId }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("Conversation initialized:", data);
          // Immediately refresh list after creating a new conversation
          fetchConversations();
        })
        .catch((err) =>
          console.error("Failed to initialize conversation:", err)
        );
    }
  }, [currentConversationId, user, token, fetchConversations]);

  // Select a conversation
  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversation(conversationId);
    setCurrentConversationId(conversationId);
    setIsNewConversation(false);
    if (isMobile) {
      setShowChat(true);
    }
  };

  // Delete a conversation
  const handleDeleteConversation = async (conversationId: string) => {
    if (!user || !token) return;
    try {
      const response = await fetch(
        `/api/conversations?conversationId=${conversationId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        setConversationList((prev) =>
          prev.filter((conv) => conv.conversationId !== conversationId)
        );
        if (selectedConversation === conversationId) {
          setSelectedConversation(null);
          setCurrentConversationId(null);
        }
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  // Mobile back to list
  const handleBackToList = () => {
    setShowChat(false);
  };

  // New conversation
  const handleNewConversation = () => {
    // First clear existing conversation state
    setSelectedConversation(null);
    setCurrentConversationId(null);
    setIsNewConversation(false);

    // Small delay to ensure state is cleared before setting new conversation
    setTimeout(() => {
      const newId = uuidv4();
      setCurrentConversationId(newId);
      setIsNewConversation(true);
      if (isMobile) {
        setShowChat(true);
      }
    }, 0);
  };

  // If user data is still loading
  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div
      className={`flex flex-col h-screen ${isMobile ? "overflow-hidden" : ""}`}
    >
      <Navbar />
      <h1
        className="text-3xl font-bold text-center py-6"
        style={{ color: "var(--foreground)" }}
      >
        دستیار هوش مصنوعی
      </h1>

      <div className="flex flex-1 overflow-hidden">
        {(!isMobile || (isMobile && !showChat)) && (
          <ConversationList
            conversationList={conversationList}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            onNewConversation={handleNewConversation}
            isMobile={isMobile}
          />
        )}

        {(!isMobile || (isMobile && showChat)) && (
          <div className="flex-1 flex flex-col">
            <ChatWindow
              conversationId={currentConversationId}
              isNewConversation={isNewConversation}
              onAutoNewConversation={handleNewConversation}
              refreshConversationList={fetchConversations}
              onBack={handleBackToList}
              isMobile={isMobile}
              selectedConversationName={
                conversationList.find(
                  (conv) => conv.conversationId === selectedConversation
                )?.name
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
