import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const prices = await prisma.price.findMany();
    return NextResponse.json({ success: true, prices });
  } catch (error) {
    console.error("Error fetching prices", error);
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
} 