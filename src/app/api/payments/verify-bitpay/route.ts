import { NextResponse } from "next/server";
import { verifyToken } from "@/utils/auth";
import prisma from "@/lib/prisma";
import FormData from "form-data";
import axios from "axios";

const BITPAY_API = "adxcv-zzadq-polkjsad-opp13opoz-1sdf455aadzmck1244567";


export async function POST(request: Request) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get transaction details from request body
    const { transId, idGet } = await request.json();
    if (!transId || !idGet) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 }
      );
    }

    // Create form data for Bitpay verification
    const form = new FormData();
    form.append("api", String(BITPAY_API));
    form.append("trans_id", transId);
    form.append("id_get", idGet);
    form.append("json", "1");
    console.log("Verifying payment with Bitpay:", { transId, idGet });

    // Call Bitpay verification endpoint
    const response = await axios({
      method: "post",
      url: "https://bitpay.ir/payment/gateway-result-second",
      data: form,
      headers: { ...form.getHeaders() },
    });

    console.log("Bitpay verification response:", response.data);
    const result = response.data; // Expect: { status, amount, cardNum, factorId }

    // Lookup the transaction record created earlier (pending) by id_get
    const transaction = await prisma.transaction.findFirst({
      where: { id_get: idGet, paymentStatus: "PENDING" },
    });
    if (!transaction) {
      throw new Error("Transaction record not found or already processed");
    }

    // Check that the transaction amount corresponds to a valid pricing option.
    const priceEntry = await prisma.price.findFirst({
      where: { price: transaction.amountPaid },
    });
    if (!priceEntry) {
      throw new Error(
        "Transaction amount does not match allowed price options"
      );
    }

    // Compute expected amount in Rials using the value from the transaction.
    const expectedAmount = Number(transaction.amountPaid) * 10000;
    if (result.status !== 1 || Number(result.amount) !== expectedAmount) {
      throw new Error(
        "Verification failed: amount mismatch or status not approved"
      );
    }

    // Payment is valid: update the transaction record and the user's validUntil.
    await prisma.$transaction(async (tx: any) => {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          paymentStatus: "COMPLETED",
          trans_id: transId, // save callback trans_id
          externalPaymentId: result.factorId,
        },
      });
      await tx.user.update({
        where: { id: transaction.userId },
        data: {
          validUntil: transaction.validUntil,
        },
      });
    });

    return NextResponse.json({
      success: true,
      hours: Number(priceEntry.time), // return the corresponding time option
      validUntil: transaction.validUntil,
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: error.message || "Payment verification failed" },
      { status: 500 }
    );
  }
}
