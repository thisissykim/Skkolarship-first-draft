import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getScholarshipById, SCHOLARSHIP_STATUS_LABELS } from "@/lib/scholarships";
import type { Scholarship } from "@/lib/scholarships";

type Props = {
  params: { id: string };
};

export default function ScholarshipDetailPage({ params }: Props) {
  const scholarship = getScholarshipById(params.id);
  if (!scholarship) notFound();

  const warnings = buildWarnings(scholarship);
  const eligibilityBullets = buildEligibilityBullets(scholarship);
  const duplicateConflictBullets = buildDuplicateConflictBullets(scholarship);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/dashboard" className="text-sm font-medium text-cyan-700">
          ← 대시보드로 돌아가기
        </Link>

        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Tag>{SCHOLARSHIP_STATUS_LABELS[scholarship.status]}</Tag>
            <Tag muted>{scholarship.source === "CAMPUS" ? "교내" : "교외"}</Tag>
            <Tag muted>{scholarship.type === "TUITION" ? "등록금성" : "생활비성"}</Tag>
          </div>

          <h1 className="mt-5 text-3xl font-semibold">{scholarship.name}</h1>
          <p className="mt-3 text-slate-600">{scholarship.amount}</p>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <InfoCard title="자격 요건" description="이 장학금을 받으려면 충족해야 하는 정량 조건이에요.">
              <ul className="space-y-2 text-sm text-slate-700">
                {eligibilityBullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="text-slate-400">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </InfoCard>
            <InfoCard title="리스크 리포트" description="지원 전에 미리 챙겨야 할 유의사항이에요 (서류 준비 기간, 마감일 혼선 등).">
              {warnings.length > 0 ? (
                <div className="space-y-3">
                  {warnings.map((warning) => (
                    <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      {warning}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">특별히 유의할 사항이 등록되어 있지 않아요.</p>
              )}
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
            <InfoCard title="중복 수혜 규칙" description="다른 장학금과 동시에 받을 수 있는지에 대한 규칙이에요.">
              <ul className="space-y-2 text-sm text-slate-700">
                {duplicateConflictBullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="text-slate-400">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </InfoCard>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {scholarship.pdfFormUrl ? (
              <a
                href={scholarship.pdfFormUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:scale-105 active:scale-95"
              >
                원문 확인하기
              </a>
            ) : null}
            {scholarship.officialUrl ? (
              <a
                href={scholarship.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:scale-105 active:scale-95"
              >
                장학금 사이트로 바로가기
              </a>
            ) : (
              <span className="text-xs text-slate-400">
                운영 기관 공식 사이트가 아직 확인되지 않았어요. 공고문 원문에서 직접 확인해주세요.
              </span>
            )}
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

// Turns the structured eligibility fields into plain-Korean bullet sentences
// instead of a raw JSON dump — same underlying data, just readable.
function buildEligibilityBullets(scholarship: Scholarship): string[] {
  const e = scholarship.eligibilityRules;
  const bullets: string[] = [];

  if (e.gradeLevels && e.gradeLevels.length > 0) {
    bullets.push(`학년 조건: ${e.gradeLevels.join(", ")}`);
  }
  if (e.minGpaRecent != null) {
    bullets.push(`직전학기 평점 ${e.minGpaRecent}점 이상`);
  }
  if (e.minCreditsRecent != null) {
    bullets.push(`직전학기 이수학점 ${e.minCreditsRecent}학점 이상`);
  }
  if (e.maxIncomeBracket != null) {
    bullets.push(`소득분위 ${e.maxIncomeBracket}구간 이하`);
  }
  if (e.specialStatusRequired && e.specialStatusRequired.length > 0) {
    bullets.push(`특수 신분 조건: ${e.specialStatusRequired.join(", ")} 중 해당자`);
  }
  if (e.requiresNationalScholarshipApplication) {
    bullets.push("한국장학재단 국가장학금 신청이 필수예요.");
  }
  if (e.notes) {
    bullets.push(e.notes);
  }
  if (bullets.length === 0) {
    bullets.push("별도의 정량 자격 조건(학년·평점·학점 등)이 등록되어 있지 않아요. 공식 공고를 확인해주세요.");
  }
  return bullets;
}

// Same idea for the duplicate-conflict rules: which other scholarships this
// one can't be combined with, in a sentence rather than a JSON blob.
function buildDuplicateConflictBullets(scholarship: Scholarship): string[] {
  const d = scholarship.duplicateConflictRules;
  const bullets: string[] = [];

  if (d?.excludedWith && d.excludedWith.length > 0) {
    bullets.push(`다음과 동시 수혜가 불가능해요: ${d.excludedWith.join(", ")}`);
  }
  // amountCapNote and excludedWith are sourced from the same raw field, so skip
  // it if it would just repeat the sentence above verbatim.
  if (d?.amountCapNote && !d.excludedWith?.includes(d.amountCapNote)) {
    bullets.push(d.amountCapNote);
  }
  if (bullets.length === 0) {
    bullets.push("중복 수혜 제한 정보가 별도로 등록되어 있지 않아요. 공식 공고를 통해 확인해주세요.");
  }
  return bullets;
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

function InfoCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-1 text-xs text-slate-400">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}
