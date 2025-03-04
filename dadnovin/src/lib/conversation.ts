import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import * as hub from "langchain/hub";
import { BufferMemory } from "langchain/memory";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import prisma from "@/lib/prisma";
import { loadOrCreateVectorStore } from "@/lib/vectorStoreManager";

const conversationRegistry: Record<
  string,
  { chain: ConversationChain; createdAt: number }
> = {};

async function createNewConversationChain(existingHistory: any[] = []) {
  // Create a streaming-enabled LLM.
  const llm = new ChatOpenAI({
    modelName: "deepseek-chat",
    openAIApiKey: process.env.DEEPSEEK_API_KEY,
    configuration: {
      baseURL: "https://api.deepseek.com/v1",
    },
    temperature: 1,
    streaming: true, // Enable streaming for later calls.
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const vectorStore = await loadOrCreateVectorStore();

  // Pull the base prompt from LangChain Hub.
  const basePrompt = (await hub.pull("loulou/lil_dadnovin")) as ChatPromptTemplate;

  // Build a prompt that accepts "history" and "context".
  const promptWithHistory = ChatPromptTemplate.fromMessages([
    ...basePrompt.promptMessages,
    new MessagesPlaceholder("history"),
    ["human", "{context}\n\nQuestion: {question}"],
  ]);

  // Initialize chat history with any existing messages.
  const messageHistory = new ChatMessageHistory();
  for (const msg of existingHistory) {
    if (msg.type === "user") {
      await messageHistory.addUserMessage(msg.content);
    } else {
      await messageHistory.addAIMessage(msg.content);
    }
  }

  // Create a memory object using the chat history.
  const memory = new BufferMemory({
    returnMessages: true,
    memoryKey: "history",
    inputKey: "question",
    chatHistory: messageHistory,
  });

  // Create the conversation chain.
  const chain = new ConversationChain({
    llm,
    prompt: promptWithHistory,
    memory,
    verbose: true,
  });

  return { chain, vectorStore };
}

export async function getOrCreateConversation(
  conversationId: string,
  userId: number
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  // Load the conversation history from the database filtering by userId.
  const messages = await prisma.conversation.findMany({
    where: { conversationId, userId },
    orderBy: { createdAt: "asc" },
  });

  const history = messages.map((msg: any) => ({
    type: msg.sender,
    content: msg.message,
  }));

  // Use a combined key for the in-memory conversation registry.
  const conversationKey = `${userId}-${conversationId}`;
  if (conversationRegistry[conversationKey]) {
    const { chain } = conversationRegistry[conversationKey];
    return {
      chain,
      vectorStore: await loadOrCreateVectorStore(),
    };
  }

  // Otherwise, create a new chain and store it.
  const { chain, vectorStore } = await createNewConversationChain(history);

  conversationRegistry[conversationKey] = {
    chain,
    createdAt: Date.now(),
  };

  return { chain, vectorStore };
} 