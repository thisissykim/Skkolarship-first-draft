import { NextResponse } from "next/server";
import { extractInformation, type JsonSchema } from "@/lib/upstage/informationExtract";
import type { ParsedTranscript } from "@/types/onboarding";

const TRANSCRIPT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    university: { type: "string", description: "대학교 이름" },
    college: { type: "string", description: "단과대학 이름" },
    department: { type: "string", description: "학과/전공 이름" },
    regular_semester_labels: {
      type: "array",
      items: { type: "string" },
      description:
        "성적표에 나온 학기 구분 표시(예: [2023년 1학기], [2024년 2학기]) 중 '정규학기'만 연대순으로 나열. " +
        "각 항목은 'YYYY-N' 형식으로 적을 것 (N은 1 또는 2). 예: [2023년 1학기] -> '2023-1'. " +
        "도전학기, 계절학기, 여름학기, 겨울학기, 교환학기 등 '1학기'/'2학기'가 아닌 특수 학기는 절대 포함하지 말 것. " +
        "연도가 중간에 비어있어도(휴학 등) 있는 그대로 나열하면 됨 — 학년 계산은 이 목록의 개수로 별도 계산함.",
    },
    gpa_cumulative: { type: "number", description: "전체 누적 평점(GPA)" },
    gpa_cumulative_scale: { type: "number", description: "평점 만점 기준. 4.5 또는 4.3" },
    percentile_cumulative: { type: "number", description: "누적 백분율(있는 경우), 0~100 사이 숫자" },
    gpa_recent: { type: "number", description: "가장 최근 학기의 평점" },
    percentile_recent: {
      type: "number",
      description:
        "성적표에 학기별로 기재된 '평점계' 값 중 가장 마지막(최근) 학기 행의 값. 직전학기 백분위를 의미함, 0~100 사이 숫자. 학기별 평점계 표가 없으면 생략할 것.",
    },
    credits_recent: { type: "number", description: "가장 최근 학기에 이수한 학점" },
    semester_credits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          semester: { type: "string", description: "'YYYY-N' 형식(N은 1 또는 2). 예: 2025년 1학기 -> '2025-1'" },
          credits: { type: "number", description: "그 학기에 이수한 학점" },
        },
      },
      description: "성적표에 나온 '정규학기'별 이수학점을 학기마다 하나씩 나열. regular_semester_labels와 같은 학기 목록을 사용할 것.",
    },
    has_f_grade_recent: { type: "boolean", description: "가장 최근 학기에 F 학점이 있는지 여부" },
    credits_total: { type: "number", description: "지금까지 이수한 전체 누적 학점" },
    course_history: {
      type: "array",
      items: { type: "string" },
      description: "수강한 과목명 목록",
    },
    exchange_semester_detected: { type: "boolean", description: "교환학생으로 이수한 학기가 포함되어 있는지 여부" },
  },
  required: [
    "university",
    "department",
    "regular_semester_labels",
    "gpa_cumulative",
    "gpa_recent",
    "credits_recent",
    "credits_total",
  ],
};

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "파일이 필요합니다." }, { status: 400 });
  }

  if (!process.env.UPSTAGE_API_KEY) {
    return NextResponse.json(
      { ok: false, message: "UPSTAGE_API_KEY가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const extracted = await extractInformation(file, TRANSCRIPT_SCHEMA, "transcript_schema");
    const transcript = normalizeTranscript(extracted);
    return NextResponse.json({ ok: true, transcript });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "성적증명서 분석에 실패했습니다." },
      { status: 502 },
    );
  }
}

function normalizeTranscript(extracted: Record<string, unknown>): ParsedTranscript {
  const semesterLabels = toRegularSemesterLabels(extracted.regular_semester_labels);
  const { gradeLevel, semesterProgress } = deriveGradeLevel(semesterLabels);
  return {
    university: toStringOrNull(extracted.university),
    college: toStringOrNull(extracted.college),
    department: toStringOrNull(extracted.department),
    grade_level: gradeLevel,
    semester_progress: semesterProgress,
    gpa_cumulative: toNumberOrNull(extracted.gpa_cumulative),
    gpa_cumulative_scale: toGpaScale(extracted.gpa_cumulative_scale),
    percentile_cumulative: toNumberOrNull(extracted.percentile_cumulative),
    gpa_recent: toNumberOrNull(extracted.gpa_recent),
    percentile_recent: toNumberOrNull(extracted.percentile_recent),
    credits_recent: toNumberOrNull(extracted.credits_recent),
    semester_credits: toSemesterCredits(extracted.semester_credits),
    has_f_grade_recent: toBooleanOrNull(extracted.has_f_grade_recent),
    credits_total: toNumberOrNull(extracted.credits_total),
    course_history: Array.isArray(extracted.course_history)
      ? extracted.course_history.filter((item): item is string => typeof item === "string")
      : [],
    exchange_semester_detected: toBooleanOrNull(extracted.exchange_semester_detected),
    parsed_at: new Date().toISOString(),
    needs_confirmation: true,
  };
}

const SEMESTER_LABEL_PATTERN = /^(\d{4})-([12])$/;

function toSemesterCredits(value: unknown): { semester: string; credits: number }[] {
  if (!Array.isArray(value)) return [];
  const entries: { semester: string; credits: number }[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const semester = (item as Record<string, unknown>).semester;
    const credits = toNumberOrNull((item as Record<string, unknown>).credits);
    if (typeof semester === "string" && SEMESTER_LABEL_PATTERN.test(semester) && credits != null) {
      entries.push({ semester, credits });
    }
  }
  return entries;
}

// Grade level from *count of regular semesters completed*, not calendar years
// since admission — a student who took a leave of absence (휴학) shouldn't be
// bumped up a year just because time passed.
function toRegularSemesterLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const labels = value.filter((item): item is string => typeof item === "string" && SEMESTER_LABEL_PATTERN.test(item));
  return Array.from(new Set(labels)).sort((a, b) => {
    const [, yearA, semA] = a.match(SEMESTER_LABEL_PATTERN)!;
    const [, yearB, semB] = b.match(SEMESTER_LABEL_PATTERN)!;
    return Number(yearA) * 10 + Number(semA) - (Number(yearB) * 10 + Number(semB));
  });
}

function deriveGradeLevel(labels: string[]): {
  gradeLevel: "1" | "2" | "3" | "4" | null;
  semesterProgress: string | null;
} {
  const count = labels.length;
  if (count === 0) return { gradeLevel: null, semesterProgress: null };

  const gradeNum = Math.min(4, Math.ceil(count / 2));
  const semesterInYear = ((count - 1) % 2) + 1;
  return {
    gradeLevel: String(gradeNum) as "1" | "2" | "3" | "4",
    semesterProgress: `${gradeNum}-${semesterInYear}`,
  };
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toGpaScale(value: unknown): 4.5 | 4.3 | null {
  const num = toNumberOrNull(value);
  if (num === 4.5 || num === 4.3) return num;
  return null;
}
