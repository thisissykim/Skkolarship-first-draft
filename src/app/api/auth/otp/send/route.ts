import { NextResponse } from "next/server";
import { createOtpCode } from "@/lib/email-otp";

const SCHOOL_EMAIL_REGEX = /@(skku\.edu|g\.skku\.edu)$/i;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();

  if (!email || !SCHOOL_EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { ok: false, message: "학교 이메일(@skku.edu 또는 @g.skku.edu)만 가능합니다." },
      { status: 400 },
    );
  }

  const result = await createOtpCode(email);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: "1분 후에 다시 시도해주세요." },
      { status: 429 },
    );
  }

  return NextResponse.json({ ok: true });
}
