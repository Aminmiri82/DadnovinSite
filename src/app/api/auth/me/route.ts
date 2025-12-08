// api/auth/me/route.ts
import { NextResponse } from "next/server";
import { verifyToken } from "@/utils/auth";
import prisma from "@/lib/prisma"; // Update import path

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Fetch the user data including validUntil directly from the user model
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        validUntil: true, // directly include validUntil
      },
    });
    console.log("**** just fetched User:", user);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Return the user data, which now directly includes validUntil
    return NextResponse.json({ user });
  } catch (error) {
    console.error("ME endpoint error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    // Cleanup
    await prisma.$disconnect();
  }
}
