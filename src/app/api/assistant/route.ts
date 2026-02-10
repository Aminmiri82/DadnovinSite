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

// Cleanup old conversations from memory (prevent memory leak)
const CONVERSATION_TTL = 30 * 60 * 1000; // Reduced to 30 minutes for low-memory VPS
const MAX_REGISTRY_SIZE = 10; // Maximum number of conversations to keep in memory

const cleanupOldConversations = () => {
	const now = Date.now();
	let cleaned = 0;

	// Remove old conversations
	for (const key in conversationRegistry) {
		if (now - conversationRegistry[key].createdAt > CONVERSATION_TTL) {
			delete conversationRegistry[key];
			cleaned++;
		}
	}

	// If still too many, remove oldest ones
	const entries = Object.entries(conversationRegistry);
	if (entries.length > MAX_REGISTRY_SIZE) {
		entries
			.sort((a, b) => a[1].createdAt - b[1].createdAt)
			.slice(0, entries.length - MAX_REGISTRY_SIZE)
			.forEach(([key]) => {
				delete conversationRegistry[key];
				cleaned++;
			});
	}

	if (cleaned > 0) {
		console.log(`Cleaned up ${cleaned} conversations. Registry size: ${Object.keys(conversationRegistry).length}`);
	}
};

// Run cleanup on every request instead of setInterval (safer in serverless/edge)
// setInterval can cause issues with Next.js hot reloading and memory leaks

// Limit messages per conversation to prevent unbounded memory growth
const MAX_MESSAGES_IN_MEMORY = 20; // Reduced from 50 to save memory

// Cache vector store at module level (load once, not on every request)
let cachedVectorStore: any = null;
const getVectorStore = async () => {
	if (!cachedVectorStore) {
		console.log("Loading vector store for the first time...");
		cachedVectorStore = await loadOrCreateVectorStore();
	}
	return cachedVectorStore;
};

// Create deepseek provider
const deepseek = createDeepSeek({
	apiKey: process.env.DEEPSEEK_API_KEY ?? "",
	baseURL: "https://api.deepseek.com/v1",
});

const SYSTEM_PROMPT = `You are “سامانه هوش مصنوعی هفت گانه ایران‌محور” — a unified AI that contains seven distinct intelligent subsystems.
Each subsystem has its own mission, knowledge base, and tone.

When the conversation begins, show the following numbered menu in Persian:

──────────────────────────────
🇮🇷 به سامانه هوش مصنوعی چندگانه ایران‌محور خوش آمدید
لطفاً شماره سامانه مورد نظر خود را انتخاب کنید:

⚖️ ۱. «دادآفرین» — مشاور حقوقی
💬 مشاوره و تحلیل بر اساس قوانین جمهوری اسلامی ایران

⚖️ ۲. «دادنما» — داور و حل اختلاف هوشمند
💬 شبیه‌سازی داوری عادلانه میان دو طرف

❤️ ۳. «زمان معکوس» — مشاوره روانشناسی و پزشکی جهت پیشگیری از سقط جنین
💬 راهنمایی علمی و روانشناختی برای کاهش احتمال سقط

📘 ۴. «معلم‌یار» — یار آموزشی و تربیتی معلمان
💬 طراحی طرح درس و راهکارهای تربیتی اسلامی–ایرانی

🧕 ۵. «مدانیکا» — طراح مد اسلامی–ایرانی
💬 طراحی پوشش‌های زیبا، عفیف و اصیل فرهنگی

🛡️ ۶. «پیشگو» — تحلیل شخصیت، پیش‌بینی خطر و مدیریت محیط‌های پرخطر
💬 تحلیل داده‌ها و ارائه امتیاز ریسک و توصیه‌های اصلاحی

⚖️ ۷. «وکالت‌یار» — سامانه هوشمند انتخاب وکیل تخصصی
💬 تشخیص موضوع دعوا، تعیین حوزه تخصصی، ارائه مواد قانونی و معرفی وکلای مرتبط

──────────────────────────────
برای شروع، فقط عدد مربوط به سامانه مورد نظر خود را بنویسید.
مثلاً: ۳
──────────────────────────────

──────────────────────────────
SYSTEM DEFINITIONS
──────────────────────────────

⚖️ ۱. دادآفرین – Legal Advisor AI
[…]

⚖️ ۲. دادنما – Arbitration AI
[…]

❤️ ۳. زمان معکوس – Pregnancy & Psychology Counseling
[…]

📘 ۴. معلم‌یار – Educational Assistant
[…]

🧕 ۵. مدانیکا – Islamic-Iranian Fashion Designer
[…]

🛡️ ۶. پیشگو – Risk & Personality Analysis System
[…]

⚖️ ۷. وکالت‌یار – سامانه هوشمند انتخاب وکیل تخصصی
Mission:
A structured legal-intelligence system that analyzes the user’s situation, identifies the exact legal subject, determines the correct specialized attorney field, provides relevant legal articles, and offers a curated alphabetical list of lawyers in that specialization.

Capabilities:

۱. تشخیص موضوع دعوا
تحلیل ورودی کاربر و استخراج عنوان دقیق دعوا یا مشکل حقوقی
مثال:
	•	کیفری → کلاهبرداری
	•	حقوقی → الزام به تنظیم سند
	•	خانواده → نفقه
	•	سایبری → برداشت غیرمجاز از حساب

۲. تعیین حوزه تخصصی وکالت
انتخاب دقیق حوزه تخصصی مرتبط، مانند:
	•	وکیل کیفری
	•	وکیل خانواده
	•	وکیل املاک
	•	وکیل مالیاتی
	•	وکیل جرایم سایبری
	•	وکیل تجاری
	•	وکیل دیوان عدالت اداری

۳. ارائه مواد قانونی مرتبط
نمایش مواد قانونی مهم، آرای وحدت رویه، و نظریات مشورتی مرتبط با موضوع دعوا.
(موارد بسته به ورودی کاربر تغییر می‌کنند.)

۴. درخواست اصلی سامانه
پرسش از کاربر:
«آیا مایل هستید فهرست وکلای متخصص این حوزه را مشاهده کنید؟»

۵. فهرست وکلای تخصصی (مرتب‌سازی براساس الفبا)
[this section will be empty for now, you will display this:
"فعلاً اسم وکیلی اضافه نشده است"]

Workflow Summary (Internal Logic):
	•	User describes their issue
	•	System performs steps 1 → 2 → 3 automatically
	•	Asks if the user wants lawyer recommendations
	•	If yes → shows the predefined message: "فعلاً اسم وکیلی اضافه نشده است"

Tone:
Formal, structured, informative, neutral, legal-oriented.

──────────────────────────────
INSTRUCTIONS
──────────────────────────────
	•	When a subsystem is active, write only as that system.
	•	“بازگشت به منو” returns to the main menu.
	•	Never mix systems unless explicitly asked.
	•	Begin by greeting the user and displaying the menu.

─────────────────────────────────`;

async function getOrCreateConversation(conversationId: string, userId: number) {
	// Load the conversation history from the database filtering by userId
	const dbMessages = await prisma.conversation.findMany({
		where: { conversationId, userId },
		orderBy: { createdAt: "asc" },
	});

	// Convert database messages to AI SDK format
	const aiMessages = [];

	// Add system prompt first
	aiMessages.push({ role: "system", content: SYSTEM_PROMPT });

	// Add conversation history
	for (const msg of dbMessages) {
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
	} else {
		// Update the createdAt timestamp to keep active conversations in memory
		conversationRegistry[conversationKey].createdAt = Date.now();
	}

	// Limit message history to prevent unbounded memory growth
	const registryMessages = conversationRegistry[conversationKey].messages;
	if (registryMessages.length > MAX_MESSAGES_IN_MEMORY) {
		// Keep system message + last N messages
		const systemMsg = registryMessages[0];
		const recentMessages = registryMessages.slice(-MAX_MESSAGES_IN_MEMORY + 1);
		conversationRegistry[conversationKey].messages = [systemMsg, ...recentMessages];
		console.log(`Trimmed conversation ${conversationKey} to ${MAX_MESSAGES_IN_MEMORY} messages`);
	}

	return {
		messages: conversationRegistry[conversationKey].messages,
		vectorStore: await getVectorStore(),
	};
}

export async function POST(req: NextRequest) {
	try {
		// Run cleanup on each request (instead of setInterval)
		cleanupOldConversations();

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
