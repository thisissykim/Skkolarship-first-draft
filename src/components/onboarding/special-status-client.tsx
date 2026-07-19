"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { scholarshipSeed } from "@/lib/scholarships";
import { buildOnboardingProfile, matchScholarships } from "@/lib/onboarding/matchScholarships";

const specialGroups = [
  ["장애인", "중증장애인", "건강보험료", "재산세"],
  ["탈북민", "다문화", "이주배경"],
  ["자립준비청년", "가족돌봄"],
  ["국가유공자", "독립유공자후손", "보훈대상자"],
  ["다자녀", "LH임대주택거주", "기타"],
];

export default function SpecialStatusClient() {
  const router = useRouter();
  const transcript = useOnboardingStore((state) => state.transcript);
  const answers = useOnboardingStore((state) => state.commonAnswers);
  const specialStatus = useOnboardingStore((state) => state.specialStatus);
  const setSpecialStatus = useOnboardingStore((state) => state.setSpecialStatus);

  const profile = useMemo(() => (transcript ? buildOnboardingProfile(transcript, answers ?? undefined, { special_status: specialStatus }) : null), [answers, specialStatus, transcript]);
  const matches = useMemo(() => (profile ? matchScholarships(profile, scholarshipSeed) : []), [profile]);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">특수계층</h1>
        <p className="mt-2 text-slate-600">해당하는 항목을 모두 선택해주세요 (없으면 건너뛰기).</p>
        {specialGroups.map((group, index) => (
          <div key={index} className="mt-6">
            <div className="flex flex-wrap gap-2">
              {group.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm ${specialStatus.includes(item as never) ? "bg-cyan-500 text-white" : "bg-slate-100"}`}
                  onClick={() => {
                    const next = specialStatus.includes(item as never)
                      ? specialStatus.filter((value) => value !== item)
                      : specialStatus.filter((value) => value !== "해당없음").concat(item as never);
                    setSpecialStatus(next as never[]);
                    console.log(matches.length);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button type="button" className="mt-6 rounded-xl border border-slate-300 px-4 py-3" onClick={() => router.push("/onboarding/region")}>
          건너뛰기
        </button>
      </section>
    </main>
  );
}

