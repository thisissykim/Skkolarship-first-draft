import crypto from "crypto";
import nodemailer from "nodemailer";

type OtpRecord = {
  code: string;
  expiresAt: number;
  createdAt: number;
};

const otpStore = new Map<string, OtpRecord>();
const lastSentAt = new Map<string, number>();

function now() {
  return Date.now();
}

function generateCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function canSend(email: string) {
  const sentAt = lastSentAt.get(email);
  return !sentAt || now() - sentAt >= 60_000;
}

function smtpTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function sendOtpEmail(email: string, code: string) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const transport = smtpTransport();

  if (!transport || !from) {
    console.log(`[mock-otp] send to ${email}: ${code}`);
    return;
  }

  await transport.sendMail({
    from,
    to: email,
    subject: "[Skkolarship] 이메일 인증코드",
    text: `인증코드: ${code}\n5분 안에 입력해주세요.`,
  });
}

export async function createOtpCode(email: string) {
  if (!canSend(email)) {
    return { ok: false as const, reason: "RATE_LIMITED" as const };
  }

  const code = generateCode();
  otpStore.set(email, {
    code,
    createdAt: now(),
    expiresAt: now() + 5 * 60_000,
  });
  lastSentAt.set(email, now());
  await sendOtpEmail(email, code);
  return { ok: true as const };
}

export async function verifyOtpCode(email: string, code: string) {
  const record = otpStore.get(email);
  if (!record) return false;
  if (record.expiresAt < now()) {
    otpStore.delete(email);
    return false;
  }
  const valid = record.code === code;
  if (valid) otpStore.delete(email);
  return valid;
}
