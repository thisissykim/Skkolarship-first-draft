"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { scholarshipSeed } from "@/lib/scholarships";
import { buildOnboardingProfile, matchScholarships } from "@/lib/onboarding/matchScholarships";

export default function RegionAffinityClient() {
  const router = useRouter();
  const transcript = useOnboardingStore((state) => state.transcript);
  const answers = useOnboardingStore((state) => state.commonAnswers);
  const specialStatus = useOnboardingStore((state) => state.specialStatus);
  const [highSchoolSido, setHighSchoolSido] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [parentOrigin, setParentOrigin] = useState("");

  const profile = useMemo(
    () => (transcript ? buildOnboardingProfile(transcript, answers ?? undefined, { special_status: specialStatus, region_affinity: { high_school_sido: highSchoolSido, birth_place: birthPlace, parent_origin_or_residence: parentOrigin } }) : null),
    [answers, birthPlace, highSchoolSido, parentOrigin, specialStatus, transcript],
  );

  const matches = useMemo(() => (profile ? matchScholarships(profile, scholarshipSeed) : []), [profile]);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">지역연고</h1>
        <p className="mt-2 text-slate-600">출신고교 소재지 / 본인 출생지 / 부모 원적·거주지를 입력하세요.</p>
        <div className="mt-6 grid gap-4">
          <input className="rounded-xl border px-4 py-3" placeholder="출신고교 소재지" value={highSchoolSido} onChange={(e) => setHighSchoolSido(e.target.value)} />
          <input className="rounded-xl border px-4 py-3" placeholder="본인 출생지" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
          <input className="rounded-xl border px-4 py-3" placeholder="부모 원적·거주지" value={parentOrigin} onChange={(e) => setParentOrigin(e.target.value)} />
        </div>
        <p className="mt-4 text-sm text-slate-500">장학금 {matches.length}개가 추가되었어요</p>
        <button type="button" className="mt-6 rounded-xl bg-slate-950 px-4 py-3 font-medium text-white" onClick={() => router.push("/dashboard")}>
          매칭 대시보드로 이동
        </button>
      </section>
    </main>
  );
}

