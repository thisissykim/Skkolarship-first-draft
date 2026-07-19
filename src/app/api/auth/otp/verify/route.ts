import { NextResponse } from "next/server";
import { verifyOtpCode } from "@/lib/email-otp";

const SCHOOL_EMAIL_REGEX = /@(skku\.edu|g\.skku\.edu)$/i;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    code?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase();
  const code = body?.code?.trim();

  if (!email || !code || !SCHOOL_EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { ok: false, message: "유효한 학교 이메일과 인증코드가 필요합니다." },
      { status: 400 },
    );
  }

  const valid = await verifyOtpCode(email, code);
  if (!valid) {
    return NextResponse.json(
      { ok: false, message: "인증코드가 올바르지 않거나 만료되었습니다." },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
