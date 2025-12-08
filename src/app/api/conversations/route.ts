import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/utils/auth";


export async function GET(req: Request) {
  try {
    // Extract user id from the request header.
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

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (conversationId) {
      const messages = await prisma.conversation.findMany({
        where: { conversationId, userId },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json(messages);
    }

    const conversations = await prisma.conversation.findMany({
      distinct: ["conversationId"],
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        conversationId: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    // Extract user id from the auth header.
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

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    await prisma.conversation.deleteMany({
      where: { conversationId, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
