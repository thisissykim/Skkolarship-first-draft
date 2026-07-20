import type { Scholarship as AppScholarship } from "@/lib/scholarships";
import type { CommonAnswers, ParsedTranscript, StudentProfileFull } from "@/types/onboarding";
import { matchScholarship as baseMatchScholarship } from "@/engine/matchScholarship";
import { convertScholarship } from "@/lib/scholarship-adapter";

export function buildOnboardingProfile(
  transcript: ParsedTranscript,
  answers?: Partial<CommonAnswers>,
  extras?: Partial<StudentProfileFull>,
): StudentProfileFull {
  const region = answers?.region;
  return {
    user_id: "onboarding-temp",
    gpa_recent: transcript.gpa_recent,
    gpa_cumulative: transcript.gpa_cumulative,
    credits_recent: transcript.credits_recent,
    grade_level: transcript.grade_level,
    income_bracket:
      typeof answers?.income_bracket === "number" ? answers.income_bracket : null,
    special_status: extras?.special_status ?? ["해당없음"],
    major: transcript.department,
    region: region
      ? {
          sido: region.sido,
          sigungu: region.sigungu,
          years_resided: region.years_resided,
        }
      : undefined,
    updated_at: new Date().toISOString(),
    current_scholarships: answers?.current_scholarships,
    nationalScholarshipApplied:
      answers?.current_scholarships?.includes("국가장학금") ?? null,
    next_semester_status: answers?.next_semester_status,
    remaining_regular_semesters: answers?.remaining_regular_semesters ?? 0,
    low_income_type: answers?.low_income_type,
    nationality: answers?.nationality,
    foreign_visa_type: answers?.foreign_visa_type,
    can_attend_mandatory_events: answers?.can_attend_mandatory_events,
    region_affinity: extras?.region_affinity,
    wish_career: extras?.wish_career,
    research_plan: extras?.research_plan,
    school_name: transcript.university,
    exchange_semester_detected: transcript.exchange_semester_detected,
    course_history: transcript.course_history,
    semester_progress: transcript.semester_progress,
    has_f_grade_recent: transcript.has_f_grade_recent,
    percentile_cumulative: transcript.percentile_cumulative,
    gpa_cumulative_scale: transcript.gpa_cumulative_scale,
    parsed_at: transcript.parsed_at,
    needs_confirmation: transcript.needs_confirmation,
  } as StudentProfileFull;
}

export function judge(profile: StudentProfileFull, scholarship: AppScholarship) {
  return baseMatchScholarship(profile as never, convertScholarship(scholarship));
}

export function matchScholarships(profile: StudentProfileFull, scholarships: AppScholarship[]) {
  return scholarships.map((scholarship) => {
    const match = judge(profile, scholarship);
    return {
      scholarship,
      ...match,
    };
  });
}
