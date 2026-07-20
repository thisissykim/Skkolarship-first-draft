"use client";

import { signIn } from "next-auth/react";

export default function LoginForm() {
  return (
    <div className="space-y-6">
      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-navy-900 px-4 py-3.5 font-semibold text-white transition hover:bg-navy-800 active:bg-navy-950"
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 3.1l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-2.9-.4-4.5z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.5 15.6 18.9 12.5 24 12.5c3.1 0 5.9 1.1 8.1 3.1l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5c-7.6 0-14.1 4.3-17.7 10.2z"
          />
          <path
            fill="#4CAF50"
            d="M24 45.5c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.4c-2.1 1.5-4.8 2.4-7.7 2.4-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.8 41.1 16.4 45.5 24 45.5z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.6 5.4C41.5 35.8 44.5 30.8 44.5 25c0-1.5-.2-2.9-.4-4.5z"
          />
        </svg>
        Google로 로그인
      </button>
    </div>
  );
}
