import { NextResponse } from "next/server";
import { verifyToken } from "@/utils/auth";
import prisma from "@/lib/prisma";
import FormData from "form-data";
import axios from "axios";

const BITPAY_API = "adxcv-zzadq-polkjsad-opp13opoz-1sdf455aadzmck1244567";
if (!BITPAY_API) {
  throw new Error("BITPAY_API_KEY is not set");
}

const BITPAY_URL = "https://bitpay.ir/payment/gateway-send"; // Test endpoint

async function initiateBitpayPayment(amount: number) {
  const form = new FormData();
  form.append("api", String(BITPAY_API));
  form.append("amount", (amount * 10000).toString()); // Convert to Rials
  form.append(
    "redirect",
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/account/payment-callback`
  );

  form.append("name", "Test Payment");
  form.append("description", `Payment for ${amount} Tomans`);
  form.append("factorId", `INV-${Date.now()}`);

  try {
    const response = await axios({
      method: "post",
      url: BITPAY_URL,
      data: form,
      headers: { ...form.getHeaders() },
      timeout: 10000, // timeout after 10 seconds
    });

    console.log("Bitpay response:", response.data);

    if (typeof response.data === "number" && response.data > 0) {
      const paymentUrl = `https://bitpay.ir/payment/gateway-${response.data}-get`;
      console.log("Generated payment URL:", paymentUrl);
      return {
        paymentUrl,
        id_get: response.data.toString(),
      };
    } else {
      switch (response.data) {
        case -1:
          throw new Error("API کد ارسالی صحیح نیست");
        case -2:
          throw new Error("مبلغ وارد شده صحیح نیست یا کمتر از 1000 ریال است");
        case -3:
          throw new Error("آدرس بازگشت مشخص نشده است");
        case -4:
          throw new Error("درگاه معتبر نیست یا در حالت انتظار است");
        case -5:
          throw new Error("خطا در اتصال به درگاه");
        default:
          throw new Error(`خطای ناشناخته از سمت درگاه: ${response.data}`);
      }
    }
  } catch (error: any) {
    console.error("Bitpay API Error:", error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    // Verify token and get user payload
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get the number of hours to purchase from the request body and validate with Price table
    const { hours } = await request.json();
    if (!hours) {
      return NextResponse.json(
        { error: "Hours not provided" },
        { status: 400 }
      );
    }

    const priceEntry = await prisma.price.findUnique({
      where: { time: hours },
    });
    if (!priceEntry) {
      return NextResponse.json(
        { error: "Invalid purchase option" },
        { status: 400 }
      );
    }

    // Compute payment amount using the price from the DB.
    const amountInUSD = Number(priceEntry.price);

    // Get current time in Iran and add the purchased hours
    const iranTime = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Tehran",
    });
    const validUntil = new Date(iranTime);
    validUntil.setHours(validUntil.getHours() + hours);

    console.log("Payment details:", {
      amount: amountInUSD,
      currentIranTime: iranTime,
      validUntil: validUntil.toString(),
      validUntilISO: validUntil.toISOString(),
      hours,
    });

    const paymentResult = await initiateBitpayPayment(amountInUSD);

    // Create a new Transaction record with PENDING status
    const pendingTransaction = await prisma.$transaction(async (tx: any) => {
      return await tx.transaction.create({
        data: {
          user: { connect: { id: payload.userId } },
          validUntil: validUntil.toISOString(),
          amountPaid: amountInUSD,
          paymentStatus: "PENDING",
          id_get: paymentResult.id_get,
        },
      });
    });

    console.log("Created pending transaction:", pendingTransaction);

    // Return payment URL and id_get to the client
    return NextResponse.json({
      success: true,
      paymentUrl: paymentResult.paymentUrl,
      id_get: paymentResult.id_get,
    });
  } catch (error: any) {
    console.error("Payment processing error:", error);
    return NextResponse.json(
      { error: error.message || "Payment processing failed" },
      { status: 500 }
    );
  }
}
