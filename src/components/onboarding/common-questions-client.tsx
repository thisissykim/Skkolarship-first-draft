"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import type { CommonAnswers, ParsedTranscript } from "@/types/onboarding";
import { scholarshipSeed } from "@/lib/scholarships";
import { buildOnboardingProfile, matchScholarships } from "@/lib/onboarding/matchScholarships";
import Logo from "@/components/brand/logo";

// A saved profile (from /api/profile) is a flattened StudentProfileFull —
// these pull the ParsedTranscript/CommonAnswers-shaped subsets back out.
function extractTranscript(saved: Record<string, unknown>): ParsedTranscript {
  return {
    university: (saved.university as string | null) ?? null,
    college: (saved.college as string | null) ?? null,
    department: (saved.department as string | null) ?? null,
    grade_level: (saved.grade_level as ParsedTranscript["grade_level"]) ?? null,
    semester_progress: (saved.semester_progress as string | null) ?? null,
    gpa_cumulative: (saved.gpa_cumulative as number | null) ?? null,
    gpa_cumulative_scale: (saved.gpa_cumulative_scale as ParsedTranscript["gpa_cumulative_scale"]) ?? null,
    percentile_cumulative: (saved.percentile_cumulative as number | null) ?? null,
    gpa_recent: (saved.gpa_recent as number | null) ?? null,
    credits_recent: (saved.credits_recent as number | null) ?? null,
    has_f_grade_recent: (saved.has_f_grade_recent as boolean | null) ?? null,
    credits_total: (saved.credits_total as number | null) ?? null,
    course_history: (saved.course_history as string[]) ?? [],
    exchange_semester_detected: (saved.exchange_semester_detected as boolean | null) ?? null,
    parsed_at: (saved.parsed_at as string) ?? new Date(0).toISOString(),
    needs_confirmation: (saved.needs_confirmation as boolean) ?? false,
  };
}

function extractCommonAnswers(saved: Record<string, unknown>, fallback: CommonAnswers): CommonAnswers {
  return {
    nationality: (saved.nationality as CommonAnswers["nationality"]) ?? fallback.nationality,
    foreign_visa_type: saved.foreign_visa_type as string | undefined,
    next_semester_status: (saved.next_semester_status as CommonAnswers["next_semester_status"]) ?? fallback.next_semester_status,
    remaining_regular_semesters: (saved.remaining_regular_semesters as number) ?? fallback.remaining_regular_semesters,
    income_bracket: (saved.income_bracket as CommonAnswers["income_bracket"]) ?? fallback.income_bracket,
    low_income_type: (saved.low_income_type as CommonAnswers["low_income_type"]) ?? fallback.low_income_type,
    region: (saved.region as CommonAnswers["region"]) ?? fallback.region,
    current_scholarships: (saved.current_scholarships as CommonAnswers["current_scholarships"]) ?? fallback.current_scholarships,
    can_attend_mandatory_events:
      (saved.can_attend_mandatory_events as CommonAnswers["can_attend_mandatory_events"]) ?? fallback.can_attend_mandatory_events,
  };
}

const fieldStyle =
  "w-full rounded-xl border border-navy-100 bg-white px-4 py-3 text-navy-900 placeholder:text-navy-300 outline-none transition focus:border-pine-500 focus:ring-2 focus:ring-pine-500/30";

const defaultAnswers: CommonAnswers = {
  nationality: "내국인",
  next_semester_status: "재학",
  remaining_regular_semesters: 4,
  income_bracket: "모름",
  low_income_type: "해당없음",
  region: { sido: "", sigungu: "", years_resided: 0 },
  current_scholarships: ["없음"],
  can_attend_mandatory_events: "예",
};

export default function CommonQuestionsClient() {
  const router = useRouter();
  const transcript = useOnboardingStore((state) => state.transcript);
  const storedAnswers = useOnboardingStore((state) => state.commonAnswers);
  const setTranscript = useOnboardingStore((state) => state.setTranscript);
  const setCommonAnswers = useOnboardingStore((state) => state.setCommonAnswers);
  const setSpecialStatus = useOnboardingStore((state) => state.setSpecialStatus);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<CommonAnswers>(() => ({ ...defaultAnswers, ...(storedAnswers ?? {}) }));

  // Fresh browser / re-login with nothing in local storage yet — pull the last saved profile from the DB
  // so returning students don't have to redo the whole questionnaire.
  useEffect(() => {
    if (transcript || storedAnswers) return;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        const saved = data?.profile as Record<string, unknown> | null;
        if (!saved) return;
        setTranscript(extractTranscript(saved));
        const restoredAnswers = extractCommonAnswers(saved, defaultAnswers);
        setCommonAnswers(restoredAnswers);
        setAnswers(restoredAnswers);
        if (Array.isArray(saved.special_status)) {
          setSpecialStatus(saved.special_status as never[]);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const questions = useMemo(
    () => [
      {
        id: "nationality",
        label: "국적",
        render: (
          <select
            className={fieldStyle}
            value={answers.nationality}
            onChange={(event) => setAnswers({ ...answers, nationality: event.target.value as CommonAnswers["nationality"] })}
          >
            <option value="내국인">내국인</option>
            <option value="재외국민">재외국민</option>
            <option value="외국인">외국인</option>
          </select>
        ),
      },
      {
        id: "next_semester_status",
        label: "다음 학기 상태",
        render: (
          <select
            className={fieldStyle}
            value={answers.next_semester_status}
            onChange={(event) => setAnswers({ ...answers, next_semester_status: event.target.value as CommonAnswers["next_semester_status"] })}
          >
            {["재학", "복학", "휴학", "졸업예정", "초과학기", "교환학생파견"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ),
      },
      {
        id: "remaining_regular_semesters",
        label: "남은 정규학기 수",
        render: (
          <input
            className={fieldStyle}
            type="number"
            value={answers.remaining_regular_semesters}
            onChange={(event) => setAnswers({ ...answers, remaining_regular_semesters: Number(event.target.value) })}
          />
        ),
      },
      {
        id: "income_bracket",
        label: "소득구간",
        render: (
          <select
            className={fieldStyle}
            value={String(answers.income_bracket)}
            onChange={(event) => {
              const value = event.target.value;
              setAnswers({
                ...answers,
                income_bracket: value === "모름" ? "모름" : value === "미산정" ? "미산정" : Number(value),
              });
            }}
          >
            <option value="모름">모름</option>
            <option value="미산정">미산정</option>
            {Array.from({ length: 10 }, (_, n) => (
              <option key={n + 1} value={n + 1}>
                {n + 1}구간
              </option>
            ))}
          </select>
        ),
      },
      {
        id: "low_income_type",
        label: "저소득 유형",
        render: (
          <select
            className={fieldStyle}
            value={answers.low_income_type}
            onChange={(event) => setAnswers({ ...answers, low_income_type: event.target.value as CommonAnswers["low_income_type"] })}
          >
            {["기초생활수급", "차상위", "한부모", "해당없음"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ),
      },
      {
        id: "region",
        label: "거주지",
        render: (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-navy-400">시/도</span>
              <input className={fieldStyle} placeholder="예: 서울시" value={answers.region.sido} onChange={(event) => setAnswers({ ...answers, region: { ...answers.region, sido: event.target.value } })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-navy-400">시/군/구</span>
              <input className={fieldStyle} placeholder="예: 종로구" value={answers.region.sigungu} onChange={(event) => setAnswers({ ...answers, region: { ...answers.region, sigungu: event.target.value } })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-navy-400">거주 연수(년)</span>
              <input className={fieldStyle} type="number" min={0} value={answers.region.years_resided} onChange={(event) => setAnswers({ ...answers, region: { ...answers.region, years_resided: Number(event.target.value) } })} />
            </label>
          </div>
        ),
      },
      {
        id: "current_scholarships",
        label: "현재 수혜 중인 장학금",
        render: (
          <div className="flex flex-wrap gap-2">
            {["없음", "국가장학금", "교내", "교외재단/기업", "부모직장학자금지원"].map((option) => (
              <button
                key={option}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  answers.current_scholarships.includes(option as never)
                    ? "bg-pine-500 text-white"
                    : "bg-navy-50 text-navy-600 hover:bg-navy-100"
                }`}
                onClick={() => {
                  const next = answers.current_scholarships.includes(option as never)
                    ? answers.current_scholarships.filter((item) => item !== option)
                    : [...answers.current_scholarships.filter((item) => item !== "없음"), option as never];
                  setAnswers({ ...answers, current_scholarships: next as CommonAnswers["current_scholarships"] });
                }}
              >
                {option}
              </button>
            ))}
          </div>
        ),
      },
    ],
    [answers],
  );

  const current = questions[index];
  const total = questions.length;

  function next() {
    if (index < total - 1) {
      setIndex(index + 1);
      return;
    }
    if (!transcript) {
      router.push("/onboarding/upload");
      return;
    }
    setCommonAnswers(answers);
    const profile = buildOnboardingProfile(transcript, answers);
    const matched = matchScholarships(profile, scholarshipSeed);
    console.log(matched);
    router.push("/onboarding/special");
  }

  function back() {
    if (index === 0) return;
    setIndex(index - 1);
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <div className="mb-8 flex justify-center">
        <Logo size="sm" />
      </div>

      <section className="rounded-[2rem] border border-navy-100 bg-white p-6 shadow-[0_20px_60px_-25px_rgba(11,28,49,0.25)] sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-pine-600">공통 필수 문항</p>
            <h1 className="mt-1 text-2xl font-extrabold text-navy-900">{current.label}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-navy-50 px-3 py-1 text-sm font-semibold text-navy-600">
            {index + 1} / {total}
          </span>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-navy-50">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-pine-500 to-pine-400 transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>

        <div className="mt-8">{current.render}</div>

        <div className="mt-10 flex gap-3">
          {index > 0 ? (
            <button
              type="button"
              className="rounded-xl border border-navy-100 bg-white px-5 py-3 font-semibold text-navy-600 transition hover:bg-navy-50"
              onClick={back}
            >
              이전
            </button>
          ) : null}
          <button
            type="button"
            className="flex-1 rounded-xl bg-navy-900 px-4 py-3 font-semibold text-white transition hover:bg-navy-800 active:bg-navy-950"
            onClick={next}
          >
            {index < total - 1 ? "다음" : "완료"}
          </button>
        </div>
      </section>
    </main>
  );
}

