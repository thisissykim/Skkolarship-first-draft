"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { scholarshipSeed } from "@/lib/scholarships";
import { buildOnboardingProfile, matchScholarships } from "@/lib/onboarding/matchScholarships";
import Logo from "@/components/brand/logo";

const fieldStyle =
  "w-full rounded-xl border border-navy-100 bg-white px-4 py-3 text-navy-900 placeholder:text-navy-300 outline-none transition focus:border-pine-500 focus:ring-2 focus:ring-pine-500/30";

export default function RegionAffinityClient() {
  const router = useRouter();
  const transcript = useOnboardingStore((state) => state.transcript);
  const answers = useOnboardingStore((state) => state.commonAnswers);
  const specialStatus = useOnboardingStore((state) => state.specialStatus);
  const setStudentProfile = useOnboardingStore((state) => state.setStudentProfile);
  const setRegionAffinity = useOnboardingStore((state) => state.setRegionAffinity);
  const setCareerInterests = useOnboardingStore((state) => state.setCareerInterests);
  const [highSchoolSido, setHighSchoolSido] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [parentOrigin, setParentOrigin] = useState("");
  const [careerInterests, setCareerInterestsInput] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const profile = useMemo(
    () =>
      transcript
        ? buildOnboardingProfile(transcript, answers ?? undefined, {
            special_status: specialStatus,
            region_affinity: { high_school_sido: highSchoolSido, birth_place: birthPlace, parent_origin_or_residence: parentOrigin },
            career_interests: careerInterests,
          })
        : null,
    [answers, birthPlace, highSchoolSido, parentOrigin, specialStatus, transcript, careerInterests],
  );

  const matches = useMemo(() => (profile ? matchScholarships(profile, scholarshipSeed) : []), [profile]);

  async function finish() {
    setRegionAffinity({ high_school_sido: highSchoolSido, birth_place: birthPlace, parent_origin_or_residence: parentOrigin });
    setCareerInterests(careerInterests);
    if (!profile) {
      router.push("/dashboard");
      return;
    }
    setSaving(true);
    setStudentProfile(profile);
    setSaving(false);
    router.push("/onboarding/extra");
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <div className="mb-8 flex justify-center">
        <Logo size="lg" />
      </div>

      <section className="rounded-[2rem] border border-navy-100 bg-white p-6 shadow-[0_20px_60px_-25px_rgba(11,28,49,0.25)] sm:p-8">
        <p className="text-xs font-bold tracking-[0.2em] text-pine-600">마지막 단계</p>
        <h1 className="mt-1 text-2xl font-extrabold text-navy-900">지역연고</h1>
        <p className="mt-2 text-navy-500">출신고교 소재지 / 본인 출생지 / 부모 원적·거주지를 입력하세요. 없으면 비워두셔도 돼요.</p>

        <div className="mt-6 grid gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-navy-400">출신고교 소재지</span>
            <input className={fieldStyle} placeholder="예: 서울시 종로구" value={highSchoolSido} onChange={(e) => setHighSchoolSido(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-navy-400">본인 출생지</span>
            <input className={fieldStyle} placeholder="예: 서울시 송파구" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-navy-400">부모 원적·거주지</span>
            <input className={fieldStyle} placeholder="예: 강원도 태백시" value={parentOrigin} onChange={(e) => setParentOrigin(e.target.value)} />
          </label>
        </div>

        <div className="mt-5">
          <span className="mb-1.5 block text-xs font-medium text-navy-400">희망 진로 (해당하는 것만, 없으면 넘어가세요)</span>
          <div className="flex flex-wrap gap-2">
            {["IT/블록체인", "언론/미디어", "농업/창업", "고시/전문자격"].map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  careerInterests.includes(item) ? "bg-pine-500 text-white" : "bg-navy-50 text-navy-600 hover:bg-navy-100"
                }`}
                onClick={() =>
                  setCareerInterestsInput((current) =>
                    current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
                  )
                }
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-5 rounded-xl bg-pine-50 px-4 py-3 text-sm font-medium text-pine-700">
          지금까지 입력한 정보로 매칭된 장학금 {matches.length}개를 찾았어요.
        </p>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            className="rounded-xl border border-navy-100 bg-white px-5 py-3 font-semibold text-navy-600 transition hover:bg-navy-50"
            onClick={() => router.push("/onboarding/special")}
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

