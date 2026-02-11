import { createDeepSeek } from "@ai-sdk/deepseek";
import { streamText, type CoreMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/utils/auth";

// Limit how many past messages we send to the AI (system + last N)
const MAX_HISTORY_MESSAGES = 20;

// Create deepseek provider
const deepseek = createDeepSeek({
	apiKey: process.env.DEEPSEEK_API_KEY ?? "",
	baseURL: "https://api.deepseek.com/v1",
});

const SYSTEM_PROMPT = `You are "سامانه هوش مصنوعی هفت گانه ایران‌محور" — a unified AI that contains seven distinct intelligent subsystems.
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
A structured legal-intelligence system that analyzes the user's situation, identifies the exact legal subject, determines the correct specialized attorney field, provides relevant legal articles, and offers a curated alphabetical list of lawyers in that specialization.

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
	•	"بازگشت به منو" returns to the main menu.
	•	Never mix systems unless explicitly asked.
	•	Begin by greeting the user and displaying the menu.

─────────────────────────────────`;

export async function POST(req: NextRequest) {
	try {
		// JWT Authorization check
		const authHeader = req.headers.get("Authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const token = authHeader.split(" ")[1];
		const payload = await verifyToken(token);
		if (!payload) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const userId = Number(payload.userId);

		// Check user's subscription
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { validUntil: true },
		});

		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		if (!user.validUntil) {
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

		const validUntil = new Date(user.validUntil);
		const iranTime = new Date().toLocaleString("en-US", {
			timeZone: "Asia/Tehran",
		});
		const currentIranTime = new Date(iranTime);

		if (validUntil < currentIranTime) {
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

		// Retrieve the conversation name from the database if it exists
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

		// Load conversation history from database (no in-memory registry needed)
		const dbMessages = await prisma.conversation.findMany({
			where: { conversationId, userId },
			orderBy: { createdAt: "asc" },
			// Only fetch the last N messages to limit memory and token usage
			take: MAX_HISTORY_MESSAGES,
		});

		// Build messages array for the AI
		const messages: CoreMessage[] = [
			{ role: "system", content: SYSTEM_PROMPT },
		];

		for (const msg of dbMessages) {
			messages.push({
				role: msg.sender === "user" ? "user" : "assistant",
				content: msg.message,
			});
		}

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

		(async () => {
			try {
				let fullResponse = "";

				const { textStream } = await streamText({
					model: deepseek("deepseek-chat"),
					messages,
					temperature: 1,
				});

				for await (const chunk of textStream) {
					sendData(JSON.stringify({ data: chunk }));
					fullResponse += chunk;
				}

				sendEvent("end", JSON.stringify({ data: "[DONE]" }));
				await writer.ready;
				await writer.close();

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
				try {
					sendEvent("error", JSON.stringify({ error: "Streaming failed" }));
					await writer.close();
				} catch {
					// Writer may already be closed
				}
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
