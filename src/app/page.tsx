export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-20">
        <div className="max-w-xl">
          <p className="mb-4 text-sm font-medium tracking-[0.3em] text-cyan-300">
            SKKOLARSHIP
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-6xl">
            성균관대 학생을 위한
            <br />
            AI 장학금 매칭 서비스
          </h1>
          <p className="mt-6 text-base leading-7 text-slate-300 sm:text-lg">
            교내, 국가, 민간 장학금을 한곳에서 확인하고 지원 가능 여부와
            신청 일정을 관리합니다.
          </p>
          <div className="mt-10 flex gap-3">
            <a
              className="inline-flex rounded-full bg-cyan-400 px-6 py-3 font-medium text-slate-950 transition hover:bg-cyan-300"
              href="/onboarding"
            >
              나에게 딱 맞는 장학금 추천받기
            </a>
            <a
              className="inline-flex rounded-full border border-white/20 px-6 py-3 font-medium text-white transition hover:bg-white/10"
              href="/login"
            >
              로그인
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
