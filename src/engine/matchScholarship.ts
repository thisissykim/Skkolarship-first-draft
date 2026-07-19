import type {
  EligibilityResult,
  EligibilityStatus,
  Scholarship,
  StudentProfile,
} from "@/types/scholarship";

export type MatchResult = EligibilityResult & {
  score: number;
  reasons: string[];
};

export function matchScholarship(profile: StudentProfile, scholarship: Scholarship): MatchResult {
  const reasons: string[] = [];
  const unmetConditions: string[] = [];
  let status: EligibilityStatus = "지원가능";
  let score = 0;

  const eligibility = scholarship.eligibility;
  const currentScholarships = profile.currentScholarships ?? [];

  if (
    scholarship.duplicate_conflict.allows_other_scholarships === "불가" &&
    currentScholarships.some((item) => item.type === scholarship.type)
  ) {
    const conflict = currentScholarships.find((item) => item.type === scholarship.type);
    return {
      scholarship_id: scholarship.id,
      status: "지원불가",
      reason_text: `현재 수혜 중인 ${conflict?.name ?? "장학금"}과 중복 수혜가 불가능합니다.`,
      unmet_conditions: ["중복수혜 불가"],
      score: 0,
      reasons: [`현재 수혜 중인 ${conflict?.name ?? "장학금"}과 중복 수혜가 불가능합니다.`],
    };
  }

  if (
    scholarship.duplicate_conflict.allows_other_scholarships === "조건부" &&
    scholarship.duplicate_conflict.cap_rule
  ) {
    reasons.push(scholarship.duplicate_conflict.cap_rule);
  }

  if (eligibility.grade_level && profile.grade_level && !matchesGrade(eligibility.grade_level, profile.grade_level)) {
    status = "지원불가";
    unmetConditions.push(`학년 조건(${eligibility.grade_level}) 미충족`);
    reasons.push(`학년 조건 ${eligibility.grade_level}에 해당하지 않습니다.`);
  }

  if (eligibility.gpa_recent_min != null) {
    if (profile.gpa_recent == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("직전학기 GPA 정보가 없어 조건부 가능으로 분류했습니다.");
    } else if (profile.gpa_recent < eligibility.gpa_recent_min) {
      status = "지원불가";
      unmetConditions.push("직전학기 GPA 미달");
      reasons.push(
        `직전학기 평점 기준 ${eligibility.gpa_recent_min}점이지만 현재 ${profile.gpa_recent}점으로 확인되어 지원이 어렵습니다.`,
      );
    } else if (profile.gpa_recent - eligibility.gpa_recent_min <= 0.1) {
      reasons.push("성적이 기준에 아슬아슬해 성적 확정 후 재확인이 필요합니다.");
    }
  }

  if (eligibility.gpa_cumulative_min != null) {
    if (profile.gpa_cumulative == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("전체 GPA 정보가 없어 조건부 가능으로 분류했습니다.");
    } else if (profile.gpa_cumulative < eligibility.gpa_cumulative_min) {
      status = "지원불가";
      unmetConditions.push("누적 GPA 미달");
      reasons.push(`전체 평점 기준 ${eligibility.gpa_cumulative_min}점이지만 현재 ${profile.gpa_cumulative}점입니다.`);
    }
  }

  if (eligibility.credits_recent_min != null) {
    if (profile.credits_recent == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("직전학기 이수학점 정보가 없어 조건부 가능으로 분류했습니다.");
    } else if (profile.credits_recent < eligibility.credits_recent_min) {
      status = "지원불가";
      unmetConditions.push("직전학기 이수학점 미달");
      reasons.push(
        `직전학기 이수학점 기준 ${eligibility.credits_recent_min}학점이지만 현재 ${profile.credits_recent}학점으로 확인되어 지원이 어렵습니다.`,
      );
    } else if (profile.credits_recent - eligibility.credits_recent_min <= 1) {
      reasons.push("이수학점이 기준에 가까워 재확인이 필요합니다.");
    }
  }

  if (eligibility.income_bracket_max != null) {
    if (profile.income_bracket == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("소득구간이 입력되지 않아 조건부 가능으로 분류했습니다.");
    } else if (profile.income_bracket > eligibility.income_bracket_max) {
      status = "지원불가";
      unmetConditions.push("소득구간 초과");
      reasons.push(
        `소득구간 기준 ${eligibility.income_bracket_max}구간 이하이지만 현재 ${profile.income_bracket}구간으로 확인되어 지원이 어렵습니다.`,
      );
    }
  }

  if (eligibility.special_status.length > 0) {
    const hasMatch = eligibility.special_status.some((item) => profile.special_status.includes(item));
    if (!hasMatch) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push(`특수신분 조건(${eligibility.special_status.join(", ")}) 확인이 필요합니다.`);
    }
  }

  if (scholarship.duplicate_conflict.allows_other_scholarships === "조건부" && scholarship.duplicate_conflict.cap_rule) {
    reasons.push(scholarship.duplicate_conflict.cap_rule);
  }

  if (scholarship.eligibility.other_conditions) {
    reasons.push(scholarship.eligibility.other_conditions);
  }

  score += computeBaseScore(status);
  score += computeMarginScore(profile, scholarship);
  score += computeMatchBonus(profile, scholarship);

  return {
    scholarship_id: scholarship.id,
    status,
    reason_text: reasons[0] ?? "조건을 검토했습니다.",
    unmet_conditions: unmetConditions.length > 0 ? unmetConditions : undefined,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}

function computeBaseScore(status: EligibilityStatus) {
  if (status === "지원가능") return 40;
  if (status === "조건부가능") return 20;
  return 0;
}

function computeMarginScore(profile: StudentProfile, scholarship: Scholarship) {
  let score = 0;
  const e = scholarship.eligibility;

  if (e.gpa_recent_min != null && profile.gpa_recent != null && profile.gpa_recent >= e.gpa_recent_min) {
    score += Math.min(10, (profile.gpa_recent - e.gpa_recent_min) * 20);
  }
  if (e.credits_recent_min != null && profile.credits_recent != null && profile.credits_recent >= e.credits_recent_min) {
    score += Math.min(10, (profile.credits_recent - e.credits_recent_min) * 2);
  }
  if (e.income_bracket_max != null && profile.income_bracket != null && profile.income_bracket <= e.income_bracket_max) {
    score += Math.max(0, 10 - (profile.income_bracket / Math.max(1, e.income_bracket_max)) * 10);
  }
  return score;
}

function computeMatchBonus(profile: StudentProfile, scholarship: Scholarship) {
  const matches = scholarship.eligibility.special_status.filter((item) => profile.special_status.includes(item)).length;
  const activityMatches = (profile.activities ?? []).filter((activity) =>
    scholarship.notes ? scholarship.notes.includes(activity) : false,
  ).length;
  return Math.min(20, matches * 5 + activityMatches * 3);
}

function matchesGrade(required: string, actual: string) {
  return required.split(",").map((item) => item.trim()).includes(actual);
}

