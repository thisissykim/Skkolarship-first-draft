"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { CONDITIONAL_TRIGGERS, WIRED_TRIGGER_IDS } from "@/types/onboarding";
import { buildOnboardingProfile, matchScholarships } from "@/lib/onboarding/matchScholarships";
import { scholarshipSeed } from "@/lib/scholarships";
import Logo from "@/components/brand/logo";

async function saveProfile(profile: unknown) {
  await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
}

// hyundai-cmk's trigger asks essentially the same thing as stem-engineering's
// ("이공계 전공인가요?"), so it reuses that answer instead of asking twice.
const QUESTION_ID_ALIAS: Record<string, string> = {
  "hyundai-cmk": "stem-track",
};

export default function ExtraQuestionsClient() {
  const router = useRouter();
  const transcript = useOnboardingStore((state) => state.transcript);
  const answers = useOnboardingStore((state) => state.commonAnswers);
  const specialStatus = useOnboardingStore((state) => state.specialStatus);
  const regionAffinity = useOnboardingStore((state) => state.regionAffinity);
  const careerInterests = useOnboardingStore((state) => state.careerInterests);
  const storedConditionalAnswers = useOnboardingStore((state) => state.conditionalAnswers);
  const setConditionalAnswers = useOnboardingStore((state) => state.setConditionalAnswers);
  const setStudentProfile = useOnboardingStore((state) => state.setStudentProfile);
  const [localAnswers, setLocalAnswers] = useState<Record<string, boolean>>(storedConditionalAnswers);
  const [saving, setSaving] = useState(false);

  const baseProfile = useMemo(
    () =>
      transcript
        ? buildOnboardingProfile(transcript, answers ?? undefined, {
            special_status: specialStatus,
            region_affinity: regionAffinity ?? undefined,
            career_interests: careerInterests,
          })
        : null,
    [answers, careerInterests, regionAffinity, specialStatus, transcript],
  );

  const activeQuestions = useMemo(() => {
    if (!baseProfile) return [];
    const seen = new Set<string>();
    const list: { id: string; label: string; helperText?: string }[] = [];
    for (const trigger of CONDITIONAL_TRIGGERS) {
      if (!WIRED_TRIGGER_IDS.includes(trigger.trigger_id)) continue;
      if (!trigger.condition(baseProfile)) continue;
      for (const question of trigger.questions) {
        if (question.type !== "boolean") continue;
        const id = QUESTION_ID_ALIAS[question.id] ?? question.id;
        if (seen.has(id)) continue;
        seen.add(id);
        list.push({ id, label: question.label, helperText: question.helperText });
      }
    }
    return list;
  }, [baseProfile]);

  const finalProfile = useMemo(
    () => (baseProfile ? { ...baseProfile, conditional_answers: localAnswers } : null),
    [baseProfile, localAnswers],
  );

  const matches = useMemo(() => (finalProfile ? matchScholarships(finalProfile, scholarshipSeed) : []), [finalProfile]);

  async function finish() {
    setConditionalAnswers(localAnswers);
    if (!finalProfile) {
      router.push("/dashboard");
      return;
    }
    setSaving(true);
    setStudentProfile(finalProfile);
    await saveProfile(finalProfile);
    setSaving(false);
    router.push("/dashboard");
  }

  // Nothing relevant to this student's profile — skip straight through instead of
  // showing an empty question screen.
  useEffect(() => {
    if (baseProfile && activeQuestions.length === 0) {
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseProfile, activeQuestions.length]);

  if (!baseProfile || activeQuestions.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center text-navy-400">
        <p>확인 중...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <div className="mb-8 flex justify-center">
        <Logo size="lg" />
      </div>

      <section className="rounded-[2rem] border border-navy-100 bg-white p-6 shadow-[0_20px_60px_-25px_rgba(11,28,49,0.25)] sm:p-8">
        <p className="text-xs font-bold tracking-[0.2em] text-pine-600">마지막 단계</p>
        <h1 className="mt-1 text-2xl font-extrabold text-navy-900">추가 확인</h1>
        <p className="mt-2 text-navy-500">일부 장학금은 아래 조건도 함께 확인해요. 해당하는 항목만 답변해주세요.</p>

        <div className="mt-6 space-y-4">
          {activeQuestions.map((question) => (
            <div key={question.id} className="rounded-xl border border-navy-100 p-4">
              <p className="font-medium text-navy-900">{question.label}</p>
              {question.helperText ? <p className="mt-1 text-xs text-navy-400">{question.helperText}</p> : null}
              <div className="mt-3 flex gap-2">
                {(["예", "아니오"] as const).map((label, index) => {
                  const value = index === 0;
                  const selected = localAnswers[question.id] === value;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        selected ? "bg-pine-500 text-white" : "bg-navy-50 text-navy-600 hover:bg-navy-100"
                      }`}
                      onClick={() => setLocalAnswers({ ...localAnswers, [question.id]: value })}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 rounded-xl bg-pine-50 px-4 py-3 text-sm font-medium text-pine-700">
          지금까지 입력한 정보로 매칭된 장학금 {matches.length}개를 찾았어요.
        </p>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            className="rounded-xl border border-navy-100 bg-white px-5 py-3 font-semibold text-navy-600 transition hover:bg-navy-50"
            onClick={() => router.push("/onboarding/region")}
          >
            이전
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-navy-900 px-4 py-3 font-semibold text-white transition hover:bg-navy-800 active:bg-navy-950 disabled:opacity-60"
            onClick={finish}
            disabled={saving}
          >
            {saving ? "저장 중..." : "매칭 대시보드로 이동"}
          </button>
        </div>
      </section>
    </main>
  );
}
