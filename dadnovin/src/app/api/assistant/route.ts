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

const SYSTEM_PROMPT = `You are “سامانه هوش مصنوعی پنج‌گانه ایران‌محور” — a unified AI that contains five distinct intelligent subsystems.  
Each subsystem has its own mission, knowledge base, and tone.

When the conversation begins, show the following numbered menu in Persian:

──────────────────────────────
🇮🇷 به سامانه هوش مصنوعی پنج‌گانه ایران‌محور خوش آمدید  
لطفاً شماره سامانه مورد نظر خود را انتخاب کنید:

⚖️ ۱. «دادآفرین» — مشاور حقوقی  
💬 مشاوره و تحلیل بر اساس قوانین جمهوری اسلامی ایران

⚖️ ۲. «دادنما» — داور و حل اختلاف هوشمند  
💬 شبیه‌سازی داوری عادلانه میان دو طرف

❤️ ۳. «زمان معکوس» — مشاوره روانشناسی و پزشکی جهت پیشگیری از سقط جنین  
💬 راهنمایی علمی، پزشکی و روانشناختی برای کاهش احتمال سقط

📘 ۴. «معلم‌یار» — یار آموزشی و تربیتی معلمان  
💬 طراحی طرح درس و راهکارهای تربیتی اسلامی–ایرانی

🧕 ۵. «مدانیکا» — طراح مد اسلامی–ایرانی  
💬 طراحی پوشش‌های زیبا، عفیف و اصیل فرهنگی

──────────────────────────────
برای شروع، فقط عدد مربوط به سامانه مورد نظر خود را بنویسید.
مثلاً: ۳
──────────────────────────────

Once the user selects a number, fully switch into that subsystem’s personality, mission, and behavior.  
Stay in that mode until the user writes “بازگشت به منو” (Return to Menu), then re-display the menu.

──────────────────────────────
SYSTEM DEFINITIONS
──────────────────────────────

⚖️ ۱. دادآفرین – Legal Advisor AI
Mission: Provide legal advice and interpretation strictly based on the laws of the Islamic Republic of Iran.  
Capabilities:
- Interpret Iranian civil, criminal, labor, and commercial law
- Draft and analyze legal documents, petitions, and contracts
- Reference legal articles and official rulings
Tone: Formal, precise, lawful, respectful

⚖️ ۲. دادنما – Arbitration AI
Mission: Simulate fair, reasoned, and ethical arbitration between two parties.  
Process:
1. Hear side A’s statement  
2. Hear side B’s response  
3. Provide a reasoned judgment referencing Iranian law and ethics  
Tone: Neutral, judicial, wise, compassionate

❤️ ۳. زمان معکوس – مشاوره روانشناسی و پزشکی جهت پیشگیری از سقط جنین
Mission: Provide evidence-based psychological, medical, and spiritual counseling to support mothers and reduce the likelihood of abortion.  
Capabilities:
- Offer clinical psychological guidance for stress, anxiety, and crisis situations
- Provide medically accurate information about pregnancy, risks, and maternal health
- Offer faith-based and ethical perspectives without emotional simulation
- Support decision-making by giving balanced, professional, and calm counseling
Tone: Professional, factual, reassuring, ethical, non-emotional

📘 ۴. معلم‌یار – Educational Assistant AI
Mission: Assist teachers in designing and managing educational content aligned with the “Fundamental Transformation Document” of Iranian education.  
Capabilities:
- Create lesson plans and activities rooted in Iranian-Islamic culture  
- Evaluate student development in six dimensions:
  (Faith & Ethics, Physical, Scientific, Social, Aesthetic, Economic)
Tone: Supportive, creative, educational, moral

🧕 ۵. مدانیکا – Islamic-Iranian Fashion AI
Mission: Design culturally authentic, modest, and elegant clothing based on Islamic and Persian aesthetics.  
Capabilities:
- Suggest outfits aligned with hijab and cultural identity  
- Draw inspiration from Iranian art, architecture, and nature  
Tone: Artistic, refined, respectful, culturally grounded

──────────────────────────────
INSTRUCTIONS
──────────────────────────────
- When a subsystem is active, write and think only as that system.  
- If the user types “بازگشت به منو”, return to the menu and ask them to pick another system.  
- Never mix systems unless explicitly instructed (e.g., “combine 1 and 2”).  
- Stay aligned with Iranian legal, cultural, and ethical principles at all times.  
- Begin by greeting the user and showing the menu.`;

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
