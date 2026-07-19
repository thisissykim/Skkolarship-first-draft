"use client";

import { useMemo, useState } from "react";
import { mockParseTranscript } from "@/lib/onboarding/mockParseTranscript";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import type { ParsedTranscript } from "@/types/onboarding";
import { useRouter } from "next/navigation";

export default function UploadOnboardingClient() {
  const router = useRouter();
  const setTranscript = useOnboardingStore((state) => state.setTranscript);
  const transcript = useOnboardingStore((state) => state.transcript);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localTranscript, setLocalTranscript] = useState<ParsedTranscript | null>(transcript);

  const confirmNeeded = useMemo(() => localTranscript?.needs_confirmation ?? false, [localTranscript]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setLoading(true);
    const parsed = await mockParseTranscript();
    setLocalTranscript(parsed);
    setTranscript(parsed);
    setLoading(false);
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold">성적증명서 업로드</h1>
        <p className="mt-2 text-slate-600">PDF 또는 이미지를 업로드하면 자동으로 인식합니다.</p>

        <label
          className={`mt-6 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 text-center transition ${
            dragActive ? "border-cyan-500 bg-cyan-50" : "border-slate-300 bg-slate-50"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <input
            className="hidden"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(event) => void handleFiles(event.target.files)}
          />
          <p className="text-sm font-medium text-slate-700">드래그앤드롭 또는 파일 선택</p>
          <p className="mt-2 text-sm text-slate-500">성적표 PDF / 이미지 파일을 넣어주세요.</p>
        </label>

        {loading ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">분석 중...</div>
        ) : null}

        {localTranscript ? (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">자동으로 채웠어요</h2>
                <p className="mt-1 text-sm text-slate-600">
                  아래 항목은 연필 아이콘으로 바로 수정할 수 있습니다.
                </p>
              </div>
              {confirmNeeded ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">확인 필요</span> : null}
            </div>

            <TranscriptCard transcript={localTranscript} onUpdate={setLocalTranscript} />

            <button
              type="button"
              className="mt-6 rounded-xl bg-slate-950 px-4 py-3 font-medium text-white"
              onClick={() => router.push("/onboarding/common")}
            >
              확인했어요, 다음으로
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function TranscriptCard({
  transcript,
  onUpdate,
}: {
  transcript: ParsedTranscript;
  onUpdate: (value: ParsedTranscript) => void;
}) {
  const fields: Array<{ key: keyof ParsedTranscript; label: string }> = [
    { key: "university", label: "대학" },
    { key: "college", label: "단과대학" },
    { key: "department", label: "학과" },
    { key: "grade_level", label: "학년" },
    { key: "semester_progress", label: "학기" },
    { key: "gpa_cumulative", label: "누적 평점" },
    { key: "gpa_cumulative_scale", label: "평점 스케일" },
    { key: "percentile_cumulative", label: "백분율" },
    { key: "gpa_recent", label: "직전학기 평점" },
    { key: "credits_recent", label: "직전학기 이수학점" },
    { key: "has_f_grade_recent", label: "F학점 유무" },
    { key: "credits_total", label: "누적 이수학점" },
  ];

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {fields.map(({ key, label }) => (
        <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <button
              type="button"
              className="text-sm text-cyan-700"
              onClick={() => {
                const next = prompt(label, String(transcript[key] ?? ""));
                if (next == null) return;
                onUpdate({
                  ...transcript,
                  [key]: next as never,
                });
              }}
            >
              ✎
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-900">{String(transcript[key] ?? "")}</p>
        </div>
      ))}
    </div>
  );
}

