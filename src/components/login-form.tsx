"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode() {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json()) as { message?: string };
    setMessage(response.ok ? "인증코드를 전송했습니다." : data.message ?? "전송 실패");
    setLoading(false);
  }

  async function verifyCode() {
    setLoading(true);
    setMessage(null);
    const result = await signIn("email-otp", {
      redirect: false,
      email,
      code,
      callbackUrl: "/dashboard",
    });
    setLoading(false);
    if (result?.ok) {
      window.location.href = result.url ?? "/dashboard";
      return;
    }
    setMessage("인증코드가 올바르지 않거나 만료되었습니다.");
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800"
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      >
        Google로 로그인
      </button>

      <div className="rounded-2xl border border-slate-200 p-4">
        <label className="text-sm font-medium text-slate-700">학교 이메일</label>
        <input
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-cyan-200 focus:ring-2"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@skku.edu"
        />

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            className="rounded-xl bg-cyan-500 px-4 py-3 font-medium text-white disabled:opacity-50"
            onClick={requestCode}
            disabled={loading || !email}
          >
            인증코드 받기
          </button>
          <input
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none ring-cyan-200 focus:ring-2"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="6자리 코드"
          />
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
            onClick={verifyCode}
            disabled={loading || !email || !code}
          >
            확인
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      <p className="text-sm text-slate-500">
        학교 계정이 없으면 이메일 OTP로 대체 로그인할 수 있습니다.
      </p>
    </div>
  );
}
