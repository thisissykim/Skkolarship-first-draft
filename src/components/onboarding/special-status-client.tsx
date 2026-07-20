"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { scholarshipSeed } from "@/lib/scholarships";
import { buildOnboardingProfile, matchScholarships } from "@/lib/onboarding/matchScholarships";
import Logo from "@/components/brand/logo";

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

  const hasSelection = specialStatus.length > 0;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <div className="mb-8 flex justify-center">
        <Logo size="sm" />
      </div>

      <section className="rounded-[2rem] border border-navy-100 bg-white p-6 shadow-[0_20px_60px_-25px_rgba(11,28,49,0.25)] sm:p-8">
        <p className="text-xs font-bold tracking-[0.2em] text-pine-600">추가 정보</p>
        <h1 className="mt-1 text-2xl font-extrabold text-navy-900">특수계층</h1>
        <p className="mt-2 text-navy-500">해당하는 항목을 모두 선택해주세요. 없으면 그냥 넘어가시면 돼요.</p>

        {specialGroups.map((group, index) => (
          <div key={index} className="mt-6">
            <div className="flex flex-wrap gap-2">
              {group.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    specialStatus.includes(item as never) ? "bg-pine-500 text-white" : "bg-navy-50 text-navy-600 hover:bg-navy-100"
                  }`}
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

        <div className="mt-10 flex gap-3">
          <button
            type="button"
            className="rounded-xl border border-navy-100 bg-white px-5 py-3 font-semibold text-navy-600 transition hover:bg-navy-50"
            onClick={() => router.push("/onboarding/common")}
          >
            이전
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-navy-900 px-4 py-3 font-semibold text-white transition hover:bg-navy-800 active:bg-navy-950"
            onClick={() => router.push("/onboarding/region")}
          >
            {hasSelection ? "다음" : "건너뛰기"}
          </button>
        </div>
      </section>
    </main>
  );
}

