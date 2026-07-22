import Logo from "@/components/brand/logo";
import LoginForm from "@/components/login-form";

export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-navy-950 bg-cover bg-center px-6 py-20 text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at 28% 18%, rgba(52,184,128,0.35), transparent 55%), " +
          "linear-gradient(180deg, rgba(4,13,25,0.88) 0%, rgba(7,21,38,0.82) 55%, rgba(4,13,25,0.94) 100%), " +
          "url(/brand/skku-campus.jpeg)",
      }}
    >
      <h1
        className="animate-fade-up max-w-2xl text-center text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl"
        style={{ animationDelay: "0ms" }}
      >
        나에게 딱 맞는 장학금 찾아보기
      </h1>

      <div className="animate-fade-up mt-10" style={{ animationDelay: "400ms" }}>
        <Logo size="lg" tone="light" />
      </div>

      <div
        className="animate-fade-up mt-10 w-full max-w-xl rounded-3xl border border-white/10 bg-white p-8 text-navy-900 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]"
        style={{ animationDelay: "800ms" }}
      >
        <p className="text-xs font-bold tracking-[0.3em] text-pine-600">SKKU 학생 전용</p>
        <h2 className="mt-3 text-3xl font-extrabold text-navy-900">로그인</h2>
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
