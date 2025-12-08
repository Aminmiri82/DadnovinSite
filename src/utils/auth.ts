import { hash, compare } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

// Create a TextEncoder once
const textEncoder = new TextEncoder();

// Convert secret to Uint8Array once
const JWT_SECRET = textEncoder.encode(
  process.env.JWT_SECRET || "your-secret-key"
);

export async function hashPassword(password: string) {
  return await hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string) {
  return await compare(password, hashedPassword);
}

export async function generateToken(userId: number) {
  try {
    const token = await new SignJWT({ userId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    return token;
  } catch (error) {
    console.error("Token generation error:", error);
    throw error;
  }
}

export async function verifyToken(token: string) {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return { userId: verified.payload.userId as number };
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}
