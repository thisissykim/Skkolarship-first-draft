import type { Scholarship } from "@/lib/scholarships";
import { scholarshipSeed } from "@/lib/scholarships";
import type { StudentProfileFull } from "@/types/onboarding";
import { judge } from "@/lib/onboarding/matchScholarships";

const STATUS_MAP: Record<string, Scholarship["status"]> = {
  지원가능: "ELIGIBLE",
  조건부가능: "CONDITIONAL",
  지원불가: "INELIGIBLE",
};

export function getPersonalizedScholarships(profile: StudentProfileFull): Scholarship[] {
  return scholarshipSeed.map((scholarship) => {
    const result = judge(profile, scholarship);
    return {
      ...scholarship,
      status: STATUS_MAP[result.status] ?? scholarship.status,
      fitScore: result.score,
    };
  });
}
