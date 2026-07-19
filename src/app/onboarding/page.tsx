export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">온보딩 시작</h1>
        <p className="mt-2 text-slate-600">먼저 성적증명서를 업로드해주세요.</p>
        <a className="mt-6 inline-flex rounded-xl bg-slate-950 px-4 py-3 font-medium text-white" href="/onboarding/upload">
          업로드 시작
        </a>
      </div>
    </main>
  );
}
