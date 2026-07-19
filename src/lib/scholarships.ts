import dataset from "@/data/scholarships.json";

export type ScholarshipStatus = "ELIGIBLE" | "CONDITIONAL" | "INELIGIBLE";
export type ScholarshipType = "TUITION" | "LIVING";
export type ScholarshipSource = "CAMPUS" | "EXTERNAL";

export type Scholarship = {
  id: string;
  name: string;
  source: ScholarshipSource;
  sourceDetail: string;
  type: ScholarshipType;
  amount: string;
  amountMaxKrw?: number | null;
  status: ScholarshipStatus;
  applyStart?: string | null;
  applyEnd?: string | null;
  applyPeriodNote?: string | null;
  officialUrl?: string | null;
  pdfFormUrl?: string | null;
  requiredDocs: string[];
  riskFlags: string[];
  tags: string[];
  fitScore: number;
  eligibilityRules: {
    minGpaRecent?: number | null;
    minCreditsRecent?: number | null;
    maxIncomeBracket?: number | null;
    gradeLevels?: string[] | null;
    requiresNationalScholarshipApplication?: boolean;
    specialStatusRequired?: string[];
    notes?: string | null;
  };
  duplicateConflictRules?: {
    excludedWith?: string[];
    amountCapNote?: string | null;
  } | null;
};

type RawScholarship = (typeof dataset.scholarships)[number];

function sourceToEnglish(source: string): ScholarshipSource {
  return source === "교내" ? "CAMPUS" : "EXTERNAL";
}

function typeToEnglish(type: string): ScholarshipType {
  return type.includes("생활비") && !type.includes("등록금") ? "LIVING" : "TUITION";
}

function buildTags(raw: RawScholarship) {
  const tags = [raw.source, raw.source_detail, raw.type];
  if (raw.duplicate_conflict.allows_other_scholarships === "불가") tags.push("중복불가");
  if (raw.needs_review) tags.push("확인필요");
  if (raw.risk_flags.length > 0) tags.push("리스크");
  return Array.from(new Set(tags));
}

function fitScore(raw: RawScholarship) {
  let score = 50;
  if (raw.eligibility.gpa_recent_min != null) score += 15;
  if (raw.eligibility.credits_recent_min != null) score += 10;
  if (raw.eligibility.income_bracket_max != null) score += 10;
  if (raw.eligibility.special_status.length > 0) score += 10;
  if (raw.needs_review) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function convert(raw: RawScholarship): Scholarship {
  return {
    id: raw.id,
    name: raw.name,
    source: sourceToEnglish(raw.source),
    sourceDetail: raw.source_detail,
    type: typeToEnglish(raw.type),
    amount: raw.amount_text ?? "",
    amountMaxKrw: raw.amount_max_krw,
    status: raw.duplicate_conflict.allows_other_scholarships === "불가" ? "INELIGIBLE" : "ELIGIBLE",
    applyStart: raw.apply_start,
    applyEnd: raw.apply_end,
    applyPeriodNote: raw.apply_period_note,
    officialUrl: raw.official_url,
    pdfFormUrl: null,
    requiredDocs: raw.required_docs,
    riskFlags: raw.risk_flags,
    tags: buildTags(raw),
    fitScore: fitScore(raw),
    eligibilityRules: {
      minGpaRecent: raw.eligibility.gpa_recent_min,
      minCreditsRecent: raw.eligibility.credits_recent_min,
      maxIncomeBracket: raw.eligibility.income_bracket_max,
      gradeLevels: raw.eligibility.grade_level ? [raw.eligibility.grade_level] : null,
      requiresNationalScholarshipApplication: raw.eligibility.other_conditions?.includes("국가장학금") ?? false,
      specialStatusRequired: raw.eligibility.special_status,
      notes: raw.eligibility.other_conditions,
    },
    duplicateConflictRules: {
      excludedWith: raw.duplicate_conflict.cap_rule ? [raw.duplicate_conflict.cap_rule] : undefined,
      amountCapNote: raw.duplicate_conflict.cap_rule,
    },
  };
}

export const scholarshipSeed: Scholarship[] = dataset.scholarships.map(convert);

export function getScholarshipById(id: string) {
  return scholarshipSeed.find((item) => item.id === id) ?? null;
}

