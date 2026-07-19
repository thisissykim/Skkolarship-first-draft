import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getScholarshipById } from "@/lib/scholarships";
import type { Scholarship } from "@/lib/scholarships";

type Props = {
  params: { id: string };
};

const CHECKLIST_OFFSETS = {
  introDraft: 7,
  recommendation: 10,
  documents: 3,
} as const;

export default function ScholarshipDetailPage({ params }: Props) {
  const scholarship = getScholarshipById(params.id);
  if (!scholarship) notFound();

  const warnings = buildWarnings(scholarship);
  const checklist = buildChecklist(scholarship);
  const calendarDays = buildCalendarDays(scholarship.applyEnd);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/dashboard" className="text-sm font-medium text-cyan-700">
          ← 대시보드로 돌아가기
        </Link>

        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Tag>{scholarship.status}</Tag>
            <Tag muted>{scholarship.source === "CAMPUS" ? "교내" : "교외"}</Tag>
            <Tag muted>{scholarship.type === "TUITION" ? "등록금성" : "생활비성"}</Tag>
          </div>

          <h1 className="mt-5 text-3xl font-semibold">{scholarship.name}</h1>
          <p className="mt-3 text-slate-600">{scholarship.amount}</p>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <InfoCard title="자격요건 구조화">
              <pre className="whitespace-pre-wrap text-sm text-slate-600">
                {JSON.stringify(scholarship.eligibilityRules, null, 2)}
              </pre>
            </InfoCard>
            <InfoCard title="리스크 리포트">
              <div className="space-y-3">
                {warnings.map((warning) => (
                  <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {warning}
                  </div>
                ))}
              </div>
            </InfoCard>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <InfoCard title="서류">
              <ul className="space-y-2 text-sm text-slate-600">
                {scholarship.requiredDocs.map((doc) => (
                  <li key={doc}>• {doc}</li>
                ))}
              </ul>
            </InfoCard>
            <InfoCard title="중복 수혜 규칙">
              <pre className="whitespace-pre-wrap text-sm text-slate-600">
                {JSON.stringify(scholarship.duplicateConflictRules ?? "확인 필요", null, 2)}
              </pre>
            </InfoCard>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <InfoCard title="역산 일정">
              <ul className="space-y-3 text-sm text-slate-700">
                {checklist.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <span>{item.label}</span>
                    <span className="text-slate-500">{item.dateLabel}</span>
                  </li>
                ))}
              </ul>
            </InfoCard>
            <InfoCard title="월간 캘린더">
              <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
                {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                  <div key={day} className="font-semibold">{day}</div>
                ))}
                {calendarDays.map((day, index) => (
                  <div
                    key={`${day.label}-${index}`}
                    className={`min-h-16 rounded-xl border p-2 text-left ${day.isCurrentMonth ? "border-slate-200 bg-white" : "border-transparent bg-slate-50 text-slate-300"}`}
                  >
                    <div className="text-xs">{day.label}</div>
                    {day.hasDeadline ? <div className="mt-2 rounded-full bg-cyan-100 px-2 py-1 text-[10px] text-cyan-800">마감</div> : null}
                  </div>
                ))}
              </div>
            </InfoCard>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {scholarship.officialUrl ? (
              <a
                href={scholarship.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white"
              >
                하이퍼링크 열기
              </a>
            ) : null}
            {scholarship.pdfFormUrl ? (
              <a
                href={scholarship.pdfFormUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
              >
                PDF 다운로드
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function buildWarnings(scholarship: Scholarship) {
  const warnings: string[] = [];
  if (scholarship.requiredDocs.some((doc) => doc.includes("추천서"))) {
    warnings.push("추천서는 발급에 시간이 걸릴 수 있어 마감 최소 10일 전에 요청하세요.");
  }
  if (scholarship.applyEnd && scholarship.applyPeriodNote && scholarship.applyPeriodNote !== scholarship.applyEnd) {
    warnings.push(`온라인 마감(${scholarship.applyEnd})과 내부 안내(${scholarship.applyPeriodNote})가 다를 수 있어 더 이른 날짜를 우선 확인하세요.`);
  }
  if (scholarship.eligibilityRules.notes) {
    warnings.push(scholarship.eligibilityRules.notes);
  }
  if (scholarship.duplicateConflictRules?.amountCapNote) {
    warnings.push(scholarship.duplicateConflictRules.amountCapNote);
  }
  return warnings;
}

function buildChecklist(scholarship: Scholarship) {
  const end = scholarship.applyEnd ? new Date(scholarship.applyEnd) : null;
  if (!end) return [];

  const items = [
    {
      label: "자기소개서 초안 완성",
      offset: CHECKLIST_OFFSETS.introDraft,
    },
    ...(scholarship.requiredDocs.some((doc) => doc.includes("추천서"))
      ? [{ label: "추천서 요청", offset: CHECKLIST_OFFSETS.recommendation }]
      : []),
    {
      label: "증빙서류 발급",
      offset: CHECKLIST_OFFSETS.documents,
    },
  ];

  return items.map((item) => {
    const date = new Date(end);
    date.setDate(date.getDate() - item.offset);
    return {
      label: `D-${item.offset} ${item.label}`,
      dateLabel: date.toISOString().slice(0, 10),
    };
  });
}

function buildCalendarDays(endDate?: string | null) {
  const today = new Date("2026-07-19T00:00:00Z");
  const base = new Date(today);
  base.setDate(1);
  const month = base.getMonth();
  const daysInMonth = new Date(base.getFullYear(), month + 1, 0).getDate();
  const startPadding = base.getDay();
  const days: Array<{ label: string; isCurrentMonth: boolean; hasDeadline: boolean }> = [];

  for (let i = 0; i < startPadding; i += 1) {
    days.push({ label: "", isCurrentMonth: false, hasDeadline: false });
  }

  const deadline = endDate ? new Date(endDate).toISOString().slice(0, 10) : null;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateLabel = `${base.getFullYear()}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({
      label: String(day),
      isCurrentMonth: true,
      hasDeadline: deadline === dateLabel,
    });
  }
  return days;
}

function Tag({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        muted ? "bg-slate-100 text-slate-600" : "bg-slate-950 text-white"
      }`}
    >
      {children}
    </span>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
