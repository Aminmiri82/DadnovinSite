import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

interface ChatMessage {
  type: "user" | "ai";
  content: string;
}

interface UseChatOptions {
  conversationId: string | null;
  isNewConversation: boolean;
}
const token = localStorage.getItem("token");

/**
 * useChat handles:
 * 1) Loading conversation history from /api/conversations.
 * 2) Sending new messages (streaming response) via /api/assistant.
 */
export function useChat({ conversationId, isNewConversation }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!conversationId || !user?.id) {
      setMessages([]);
      return;
    }
    if (isNewConversation) {
      // Skip fetching messages if it's a new conversation.
      return;
    }
    // Load existing messages from the backend.
    const fetchOldMessages = async () => {
      try {
        const res = await fetch(
          `/api/conversations?conversationId=${conversationId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await res.json();
        const loadedMessages: ChatMessage[] = data.map((msg: any) => ({
          type: msg.sender === "user" ? "user" : "ai",
          content: msg.message,
        }));
        setMessages(loadedMessages);
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    };
    fetchOldMessages();
  }, [conversationId, user, isNewConversation]);

  const sendMessage = useCallback(
    async (userInput: string) => {
      if (!user) {
        console.error("User not authenticated");
        return;
      }
      if (!userInput.trim() || !conversationId) return;
      setIsLoading(true);
      // Add the user message optimistically.
      setMessages((prev) => [...prev, { type: "user", content: userInput }]);

      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: userInput,
            conversationId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage =
            errorData.message?.fa ||
            "خطایی رخ داده است. لطفا دوباره تلاش کنید.";

          if (response.status === 403) {
            if (
              errorData.code === "NO_SUBSCRIPTION" ||
              errorData.code === "SUBSCRIPTION_EXPIRED"
            ) {
              setMessages((prev) => [
                ...prev,
                {
                  type: "ai",
                  content: errorMessage,
                },
              ]);
              setIsLoading(false);
              return;
            }
          }

          throw new Error(errorMessage);
        }

        const data = response.body;
        if (!data) {
          throw new Error("No response body");
        }
        const reader = data.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let aiResponse = "";
        // Add a placeholder for the AI response.
        setMessages((prev) => [...prev, { type: "ai", content: "" }]);
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          const chunkValue = decoder.decode(value);
          const lines = chunkValue.split("\n");
          for (const line of lines) {
            if (line.startsWith("data:")) {
              const jsonString = line.substring(5).trim();
              if (jsonString !== "") {
                const { data } = JSON.parse(jsonString);
                if (data !== "[DONE]") {
                  aiResponse += data;
                  setMessages((prev) => {
                    const lastMsg = prev[prev.length - 1];
                    if (!lastMsg || lastMsg.type !== "ai") return prev;
                    const updatedMsg = {
                      ...lastMsg,
                      content: lastMsg.content + data,
                    };
                    return [...prev.slice(0, -1), updatedMsg];
                  });
                } else {
                  done = true;
                }
              }
            } else if (line.startsWith("event: end")) {
              done = true;
            }
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
        setMessages((prev) => [
          ...prev,
          { type: "ai", content: "An error occurred. Please try again." },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [user, conversationId]
  );

  return { messages, isLoading, sendMessage };
}
