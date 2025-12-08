import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  return NextResponse.json({
    serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    serverTime: new Date().toString(),
    serverTimeUTC: new Date().toUTCString(),
    envTZ: process.env.TZ,
    // Additional check using Linux command
    systemTimezone: execSync("cat /etc/timezone").toString().trim(),
  });
}
