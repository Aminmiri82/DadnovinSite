import { createDeepSeek } from "@ai-sdk/deepseek";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/utils/auth";
import { loadOrCreateVectorStore } from "../../../lib/vectorStoreManager";

// Registry to store conversation histories in memory
const conversationRegistry: Record<
	string,
	{ messages: any[]; createdAt: number }
> = {};

// Create deepseek provider
const deepseek = createDeepSeek({
	apiKey: process.env.DEEPSEEK_API_KEY ?? "",
	baseURL: "https://api.deepseek.com/v1",
});

const SYSTEM_PROMPT = `You are an AI assistant designed to interpret legal queries and provide nuanced answers by referencing a comprehensive database of Persian law books.
what ever happens, you're only supposed to answer in Persian.
If the users asked for more info on the matter, then give them the proper answer.
For the references just put the name of the document and the paragraph of the document in farsi.
You are an AI assistant who knows the iranian laws. You are in a situation where two people have a conflict with each other. each side will give you their case and then you have to give a final opinion on who is guilty and what the charge is. first you will take the first person's side of the case and then you will ask for the second person. 
you will converse with the user in farsi/persian.
the persian work for "case" is پرونده. so please use the correct wods.
You will first start by introducing yourself and telling the user that they're now User1 and ask them their side of the story, and when they do, you tell them that now they should let User2 type their stuff, alternate between them till you feel comfortable enough to come up with a verdict. always make sure to TELL the user whether they're User1 or 2
You should also ask the user to tell you their name and the name of the other person whenever they write a message.`;

async function getOrCreateConversation(conversationId: string, userId: number) {
	// Load the conversation history from the database filtering by userId
	const messages = await prisma.conversation.findMany({
		where: { conversationId, userId },
		orderBy: { createdAt: "asc" },
	});

	// Convert database messages to AI SDK format
	const aiMessages = [];

	// Add system prompt first
	aiMessages.push({ role: "system", content: SYSTEM_PROMPT });

	// Add conversation history
	for (const msg of messages) {
		const role = msg.sender === "user" ? "user" : "assistant";
		aiMessages.push({ role, content: msg.message });
	}

	// Use a combined key for the in-memory conversation registry
	const conversationKey = `${userId}-${conversationId}`;

	if (!conversationRegistry[conversationKey]) {
		conversationRegistry[conversationKey] = {
			messages: aiMessages,
			createdAt: Date.now(),
		};
	}

	return {
		messages: conversationRegistry[conversationKey].messages,
		vectorStore: await loadOrCreateVectorStore(),
	};
}

export async function POST(req: NextRequest) {
	try {
		// JWT Authorization check
		const authHeader = req.headers.get("Authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			console.log("No or invalid Authorization header");
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const token = authHeader.split(" ")[1];
		const payload = await verifyToken(token);
		if (!payload) {
			console.log("Invalid token");
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const userId = Number(payload.userId);

		// Check user's subscription
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { validUntil: true },
		});

		console.log("User subscription check:", {
			userId,
			validUntil: user?.validUntil,
		});

		if (!user) {
			console.log("User not found:", userId);
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		if (!user.validUntil) {
			console.log("No valid subscription for user:", userId);
			return NextResponse.json(
				{
					error: "Subscription required",
					code: "NO_SUBSCRIPTION",
					message: {
						en: "You need an active subscription to use the AI assistant.",
						fa: "برای استفاده از دستیار هوش مصنوعی نیاز به اشتراک فعال دارید.",
					},
				},
				{ status: 403 }
			);
		}

		// Convert validUntil to Date object
		const validUntil = new Date(user.validUntil);
		// Get current time in Iran
		const iranTime = new Date().toLocaleString("en-US", {
			timeZone: "Asia/Tehran",
		});
		const currentIranTime = new Date(iranTime);

		console.log("Time check:", {
			validUntil,
			currentIranTime,
			isExpired: validUntil < currentIranTime,
		});

		if (validUntil < currentIranTime) {
			console.log("Subscription expired for user:", userId);
			return NextResponse.json(
				{
					error: "Subscription expired",
					code: "SUBSCRIPTION_EXPIRED",
					message: {
						en: "Your subscription has expired. Please renew your subscription to continue using the AI assistant.",
						fa: "اشتراک شما منقضی شده است. لطفاً برای ادامه استفاده از دستیار هوش مصنوعی، اشتراک خود را تمدید کنید.",
					},
				},
				{ status: 403 }
			);
		}

		const data: { message: string; conversationId: string } = await req.json();
		const message = data.message;
		const conversationId = data.conversationId;

		if (!message) {
			return NextResponse.json(
				{ error: "Message is required" },
				{ status: 400 }
			);
		}

		// Retrieve the conversation name from the database if it exists (filtered by userId)
		const name =
			(
				await prisma.conversation.findFirst({
					where: { conversationId, userId },
					select: { name: true },
				})
			)?.name || `c${Date.now()}`;

		// Save the user's message to the database
		await prisma.conversation.create({
			data: {
				userId,
				message: data.message,
				sender: "user",
				conversationId,
				name,
			},
		});

		// Retrieve the existing conversation data from our registry
		const { messages, vectorStore } = await getOrCreateConversation(
			conversationId,
			userId
		);

		// Get additional context via vectorStore
		const searchResults = await vectorStore.similaritySearch(message, 5);
		const context = searchResults
			.map((doc: { pageContent: string }) => doc.pageContent)
			.join("\n");

		// Add the user message with context to the messages array
		messages.push({
			role: "user",
			content: `name: User - question: ${message}\n\nRelevant context:\n${context}`,
		});

		// Prepare a streaming response
		const encoder = new TextEncoder();
		const stream = new TransformStream();
		const writer = stream.writable.getWriter();

		const sendData = (data: string) => {
			writer.write(encoder.encode(`data: ${data}\n\n`));
		};

		const sendEvent = (event: string, data: string) => {
			writer.write(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
		};

		// Logging timezone info
		console.log({
			serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			serverTime: new Date().toString(),
			serverTimeUTC: new Date().toUTCString(),
			envTZ: process.env.TZ,
		});

		(async () => {
			try {
				let fullResponse = "";

				// Use Vercel AI SDK's streamText for generating a response
				const { textStream } = await streamText({
					model: deepseek("deepseek-chat"),
					messages,
					temperature: 1,
				});

				// Process the streaming response
				for await (const chunk of textStream) {
					sendData(JSON.stringify({ data: chunk }));
					fullResponse += chunk;
				}

				// Signal the end of streaming
				sendEvent("end", JSON.stringify({ data: "[DONE]" }));
				await writer.ready;
				await writer.close();

				// Add the assistant response to the messages array
				messages.push({ role: "assistant", content: fullResponse });

				// Save the AI's response to the database
				await prisma.conversation.create({
					data: {
						userId,
						message: fullResponse,
						sender: "ai",
						conversationId,
						name,
					},
				});
			} catch (error) {
				console.error("Streaming error:", error);
				sendEvent("error", JSON.stringify({ error: "Streaming failed" }));
				await writer.close();
			}
		})();

		return new NextResponse(stream.readable, {
			headers: {
				"Content-Type": "text/event-stream",
				Connection: "keep-alive",
				"Cache-Control": "no-cache, no-transform",
			},
		});
	} catch (error) {
		console.error("Error in assistant API:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
