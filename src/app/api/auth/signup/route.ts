import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/utils/auth";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName } = await request.json();
    console.log("Signup attempt:", { email, firstName, lastName }); // Log signup attempt

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log("User already exists:", email);
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        validUntil: new Date(new Date().getTime() + 100 * 24 * 60 * 60 * 1000), // 100 days
      },
    });

    console.log("User created successfully:", user.id);

    return NextResponse.json({
      message: "User created successfully",
      userId: user.id,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
