"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import type { CommonAnswers } from "@/types/onboarding";
import { scholarshipSeed } from "@/lib/scholarships";
import { buildOnboardingProfile, matchScholarships } from "@/lib/onboarding/matchScholarships";

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
  const setCommonAnswers = useOnboardingStore((state) => state.setCommonAnswers);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<CommonAnswers>(defaultAnswers);
  const questions = useMemo(
    () => [
      {
        id: "nationality",
        label: "국적",
        render: (
          <select
            className="w-full rounded-xl border px-4 py-3"
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
            className="w-full rounded-xl border px-4 py-3"
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
            className="w-full rounded-xl border px-4 py-3"
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
            className="w-full rounded-xl border px-4 py-3"
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
            className="w-full rounded-xl border px-4 py-3"
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
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="rounded-xl border px-4 py-3" placeholder="시도" value={answers.region.sido} onChange={(event) => setAnswers({ ...answers, region: { ...answers.region, sido: event.target.value } })} />
            <input className="rounded-xl border px-4 py-3" placeholder="시군구" value={answers.region.sigungu} onChange={(event) => setAnswers({ ...answers, region: { ...answers.region, sigungu: event.target.value } })} />
            <input className="rounded-xl border px-4 py-3" type="number" placeholder="거주연수" value={answers.region.years_resided} onChange={(event) => setAnswers({ ...answers, region: { ...answers.region, years_resided: Number(event.target.value) } })} />
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
                className={`rounded-full px-4 py-2 text-sm ${answers.current_scholarships.includes(option as never) ? "bg-cyan-500 text-white" : "bg-slate-100"}`}
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
      {
        id: "can_attend_mandatory_events",
        label: "필수 행사 참여 가능 여부",
        render: (
          <select
            className="w-full rounded-xl border px-4 py-3"
            value={answers.can_attend_mandatory_events}
            onChange={(event) => setAnswers({ ...answers, can_attend_mandatory_events: event.target.value as CommonAnswers["can_attend_mandatory_events"] })}
          >
            {["예", "아니오", "조건부가능"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ),
      },
    ],
    [answers],
  );

  const current = questions[index];

  function next() {
    if (index < questions.length - 1) {
      setIndex(index + 1);
      return;
    }
    if (!transcript) return;
    setCommonAnswers(answers);
    const profile = buildOnboardingProfile(transcript, answers);
    const matched = matchScholarships(profile, scholarshipSeed);
    console.log(matched);
    router.push("/onboarding/special");
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">공통 필수 8문항</h1>
          <span className="text-sm font-medium text-slate-500">
            {index + 1}/8
          </span>
        </div>
        <div className="mt-5 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${((index + 1) / 8) * 100}%` }} />
        </div>
        <div className="mt-8">
          <p className="text-sm font-medium text-slate-500">{current.label}</p>
          <div className="mt-3">{current.render}</div>
        </div>
        <button type="button" className="mt-8 rounded-xl bg-slate-950 px-4 py-3 font-medium text-white" onClick={next}>
          다음
        </button>
      </section>
    </main>
  );
}

