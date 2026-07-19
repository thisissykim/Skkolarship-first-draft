import type {
  Scholarship as NewScholarship,
  ScholarshipDataset,
  StudentProfile as NewStudentProfile,
} from "@/types/scholarship";
import { scholarshipSeed } from "@/lib/scholarships";

export function getScholarshipDataset(): ScholarshipDataset {
  return {
    schema_version: "0.1",
    generated_at: "2026-07-19",
    source_note: "Local seed dataset converted from the app scaffold.",
    count: scholarshipSeed.length,
    field_guide: {
      source: "교내/교외",
      source_detail: "교내/국가/지자체/민간재단/민간(교내연계)",
      type: "장학금 성격",
      amount_text: "사람이 읽는 금액 설명",
      amount_max_krw: "연간 최대 추정 금액",
      eligibility: "자격요건 구조화 정보",
      duplicate_conflict: "중복 수혜 규칙",
      apply_channel: "신청 경로",
      needs_review: "자동 검수 필요 여부",
    },
    scholarships: scholarshipSeed.map(convertScholarship),
  };
}

export function convertScholarship(source: (typeof scholarshipSeed)[number]): NewScholarship {
  const sourceDetail = source.source === "CAMPUS" ? "교내" : "민간재단";
  const type =
    source.type === "TUITION"
      ? "등록금성"
      : "생활비성";

  return {
    id: source.id,
    name: source.name,
    source: source.source === "CAMPUS" ? "교내" : "교외",
    source_detail: sourceDetail,
    type,
    amount_text: source.amount,
    amount_max_krw: inferAmountMax(source.amount),
    recommended_slots: null,
    apply_start: source.applyStart ?? null,
    apply_end: source.applyEnd ?? null,
    apply_period_note: null,
    eligibility: {
      grade_level: source.eligibilityRules.gradeLevels?.join(",") ?? null,
      gpa_recent_min: source.eligibilityRules.minGpaRecent ?? null,
      gpa_cumulative_min: null,
      gpa_scale: 4.5,
      credits_recent_min: source.eligibilityRules.minCreditsRecent ?? null,
      credits_recent_min_last_semester: null,
      income_bracket_max: source.eligibilityRules.maxIncomeBracket ?? null,
      special_status: source.eligibilityRules.specialStatusRequired ?? [],
      major_requirement: null,
      region_requirement: null,
      other_conditions: source.eligibilityRules.notes ?? null,
    },
    duplicate_conflict: {
      allows_other_scholarships: "미확인",
      cap_rule: source.duplicateConflictRules?.amountCapNote ?? null,
    },
    required_docs: source.requiredDocs,
    official_url: source.officialUrl ?? null,
    apply_channel: "기타",
    risk_flags: source.riskFlags,
    needs_review: Boolean(source.duplicateConflictRules == null),
    notes: source.eligibilityRules.notes ?? null,
  };
}

export function convertStudentProfile(profile: NewStudentProfile) {
  return {
    user_id: profile.user_id,
    gpa_recent: profile.gpa_recent,
    gpa_cumulative: profile.gpa_cumulative,
    credits_recent: profile.credits_recent,
    grade_level: profile.grade_level,
    income_bracket: profile.income_bracket,
    special_status: profile.special_status,
    major: profile.major,
    region: profile.region,
    updated_at: profile.updated_at,
    nationalScholarshipApplied: profile.nationalScholarshipApplied ?? null,
    currentScholarships: profile.currentScholarships ?? [],
    activities: profile.activities ?? [],
    enrollmentStatus: profile.enrollmentStatus ?? null,
  };
}

function inferAmountMax(amount: string) {
  const match = amount.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*만원/);
  if (!match) return null;
  return Math.round(Number(match[1]) * 10000);
}

