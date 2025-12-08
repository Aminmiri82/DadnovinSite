import { NextRequest, NextResponse } from "next/server";
import { getOrCreateConversation } from "@/lib/conversation"; // adjust the relative import if needed

export async function POST(req: NextRequest) {
  try {
    // Extract the user ID from the request header
    const headerUserId = req.headers.get("x-user-id");
    if (!headerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(headerUserId);

    const { conversationId } = await req.json();
    // If no conversationId is provided, the client should generate one.
    const id = conversationId;

    // Pass both conversationId and userId for creating or retrieving the conversation chain.
    await getOrCreateConversation(id, userId);

    return NextResponse.json({
      conversationId: id,
      message: "Conversation initialized.",
    });
  } catch (error) {
    console.error("Error in conversation initialization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
