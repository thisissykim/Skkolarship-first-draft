import LoginForm from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-[0.25em] text-cyan-700">SKKOLARSHIP</p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">로그인</h1>
        <p className="mt-2 text-slate-600">
          학교 Google 계정으로 로그인하거나, @skku.edu 이메일 인증코드로
          접속할 수 있습니다.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
