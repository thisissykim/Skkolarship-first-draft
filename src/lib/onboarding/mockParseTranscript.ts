import type { ParsedTranscript } from "@/types/onboarding";

export async function mockParseTranscript(): Promise<ParsedTranscript> {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return {
    university: "성균관대학교",
    college: "경영대학",
    department: "경영학과",
    grade_level: "3",
    semester_progress: "3-1",
    gpa_cumulative: 3.72,
    gpa_cumulative_scale: 4.5,
    percentile_cumulative: 91,
    gpa_recent: 3.8,
    credits_recent: 15,
    has_f_grade_recent: false,
    credits_total: 87,
    course_history: ["회계원리", "경영통계", "조직행동론", "마케팅원론"],
    exchange_semester_detected: false,
    parsed_at: new Date().toISOString(),
    needs_confirmation: true,
  };
}

