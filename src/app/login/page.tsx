import Logo from "@/components/brand/logo";
import LoginForm from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16">
      <Logo size="lg" className="mb-10" />
      <div className="w-full rounded-3xl border border-navy-100 bg-white p-8 shadow-[0_20px_60px_-25px_rgba(11,28,49,0.35)]">
        <p className="text-xs font-bold tracking-[0.3em] text-pine-600">SKKU 학생 전용</p>
        <h1 className="mt-3 text-3xl font-extrabold text-navy-900">로그인</h1>
        <p className="mt-2 text-navy-500">
          학교 Google 계정(g.skku.edu)으로 로그인하고 나에게 맞는 장학금을 찾아보세요.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
