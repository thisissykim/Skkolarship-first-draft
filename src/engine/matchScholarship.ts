import type {
  EligibilityResult,
  EligibilityStatus,
  Scholarship,
  StudentProfile,
} from "@/types/scholarship";

export type MatchCriterion = {
  key: string;
  label: string;
  met: boolean;
  detail: string;
  actionHint?: string;
};

export type MatchResult = EligibilityResult & {
  score: number;
  reasons: string[];
  criteria: MatchCriterion[];
};

export function matchScholarship(profile: StudentProfile, scholarship: Scholarship): MatchResult {
  const reasons: string[] = [];
  const unmetConditions: string[] = [];
  const criteria: MatchCriterion[] = [];
  let status: EligibilityStatus = "지원가능";

  const eligibility = scholarship.eligibility;
  const currentScholarships = profile.currentScholarships ?? [];

  // 중복 수혜
  if (scholarship.duplicate_conflict.allows_other_scholarships === "불가") {
    const conflict = currentScholarships.find((item) => item.type === scholarship.type);
    if (conflict) {
      status = "지원불가";
      unmetConditions.push("중복수혜 불가");
      const detail = `현재 수혜 중인 ${conflict.name}과 중복 수혜가 불가능합니다.`;
      reasons.push(detail);
      criteria.push({
        key: "duplicate_conflict",
        label: "중복 수혜 여부",
        met: false,
        detail,
        actionHint: "이미 받고 있는 장학금과는 중복 신청이 어려운 조건이에요.",
      });
    } else {
      criteria.push({
        key: "duplicate_conflict",
        label: "중복 수혜 여부",
        met: true,
        detail: "현재 수혜 중인 동일 유형 장학금이 없어 중복 조건에 해당하지 않습니다.",
      });
    }
  }

  if (scholarship.duplicate_conflict.allows_other_scholarships === "조건부" && scholarship.duplicate_conflict.cap_rule) {
    reasons.push(scholarship.duplicate_conflict.cap_rule);
  }

  // 학년 — grade_level is free text ("전학년", "2, 3, 4학년(...)", "3학년 이상", "2~4학년" etc.),
  // not a clean list, so pull out explicit grade digits and only reject when we can confidently
  // parse a restriction. Ambiguous/unparseable text defaults to "no restriction" rather than a
  // false rejection (e.g. "전학년" was previously compared as a literal string and always failed).
  if (eligibility.grade_level) {
    const gradeDigits = extractGradeDigits(eligibility.grade_level);
    const met = gradeDigits.size === 0 || (Boolean(profile.grade_level) && gradeDigits.has(profile.grade_level as string));
    if (!met) {
      status = "지원불가";
      unmetConditions.push(`학년 조건(${eligibility.grade_level}) 미충족`);
      reasons.push(`학년 조건 ${eligibility.grade_level}에 해당하지 않습니다.`);
    }
    criteria.push({
      key: "grade_level",
      label: "학년",
      met,
      detail:
        gradeDigits.size === 0
          ? `학년 제한 없음 (공고 문구: "${eligibility.grade_level}")`
          : `요구 학년: ${eligibility.grade_level} / 내 학년: ${profile.grade_level ?? "미확인"}`,
      actionHint: met ? undefined : "학년이 바뀌면 다시 확인해보세요.",
    });
  }

  // 초과학기 수혜 불가 — grade_level/other_conditions often carries this as a note rather than
  // a structured field, so check the free text and cross-reference the student's enrollment status.
  if (/초과학기.{0,4}(불가|제외)/.test(`${eligibility.grade_level ?? ""} ${eligibility.other_conditions ?? ""}`)) {
    const enrollmentStatus =
      (profile as unknown as { next_semester_status?: string | null }).next_semester_status ??
      profile.enrollmentStatus ??
      null;
    if (enrollmentStatus === "초과학기") {
      status = "지원불가";
      unmetConditions.push("초과학기 수혜 불가");
      reasons.push("초과학기 재학 예정이라 이 장학금은 지원이 어렵습니다.");
      criteria.push({
        key: "enrollment_status",
        label: "재학 상태",
        met: false,
        detail: "이 장학금은 초과학기 재학생은 수혜가 불가능해요.",
        actionHint: "정규학기 재학 상태가 되면 다시 확인해보세요.",
      });
    } else if (enrollmentStatus) {
      criteria.push({
        key: "enrollment_status",
        label: "재학 상태",
        met: true,
        detail: `초과학기 재학생은 제외되는 조건인데, 다음학기 상태(${enrollmentStatus})는 해당하지 않아요.`,
      });
    }
  }

  // 거주 지역 — the seed data has real region_requirement text ("강남구 관내
  // 연속 1년 이상 거주" 등) and onboarding collects profile.region, but nothing
  // was ever connecting the two, so residency-only scholarships (구청/시 장학금)
  // always fell through as ELIGIBLE regardless of where the student lives.
  if (eligibility.region_requirement) {
    const profileRegion = (profile as unknown as {
      region?: { sido?: string | null; sigungu?: string | null; years_resided?: number | null };
    }).region;
    const parsed = parseRegionRequirement(eligibility.region_requirement);

    if (!profileRegion || (!profileRegion.sido && !profileRegion.sigungu)) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("거주 지역 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "region",
        label: "거주 지역",
        met: false,
        detail: `요구 지역: ${eligibility.region_requirement} / 내 거주 지역 정보 없음`,
        actionHint: "온보딩에서 거주 지역 정보를 입력해주세요.",
      });
    } else if (!parsed) {
      // Requirement text doesn't match a clean "OO시/구 N년 이상 거주" pattern
      // (e.g. OR conditions, "서울 소재 대학 재학" 등) — don't guess, ask the
      // student to double check rather than silently marking ELIGIBLE.
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("거주 지역 조건이 자동으로 판별하기 어려운 형태라 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "region",
        label: "거주 지역",
        met: false,
        detail: `요구 지역 조건: ${eligibility.region_requirement} — 자동 판별이 어려워요.`,
        actionHint: "공식 공고에서 거주 지역 조건을 직접 확인해주세요.",
      });
    } else {
      const studentDistrict = profileRegion.sigungu || profileRegion.sido || "";
      const districtMatches =
        studentDistrict.includes(parsed.district) || parsed.district.includes(studentDistrict);
      const years = profileRegion.years_resided ?? 0;
      const yearsMet = years >= parsed.minYears;
      const met = districtMatches && yearsMet;

      if (!met) {
        status = "지원불가";
        unmetConditions.push(`거주 지역 조건(${eligibility.region_requirement}) 미충족`);
        reasons.push(
          !districtMatches
            ? `거주 지역 조건(${parsed.district})에 해당하지 않습니다.`
            : `거주 기간이 기준(${parsed.minYears}년 이상)보다 짧습니다.`,
        );
      }
      criteria.push({
        key: "region",
        label: "거주 지역",
        met,
        detail: `요구 지역: ${eligibility.region_requirement} / 내 거주 지역: ${studentDistrict || "미확인"}(${years}년 거주)`,
        actionHint: met ? undefined : "거주 지역이나 거주 기간이 바뀌면 다시 확인해보세요.",
      });
    }
  }

  // 직전학기 평점
  if (eligibility.gpa_recent_min != null) {
    if (profile.gpa_recent == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("직전학기 GPA 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "gpa_recent",
        label: "직전학기 평점",
        met: false,
        detail: `기준 ${eligibility.gpa_recent_min}점 이상 / 내 성적 정보 없음`,
        actionHint: "성적증명서 정보를 다시 확인해주세요.",
      });
    } else if (profile.gpa_recent < eligibility.gpa_recent_min) {
      status = "지원불가";
      unmetConditions.push("직전학기 GPA 미달");
      reasons.push(
        `직전학기 평점 기준 ${eligibility.gpa_recent_min}점이지만 현재 ${profile.gpa_recent}점으로 확인되어 지원이 어렵습니다.`,
      );
      criteria.push({
        key: "gpa_recent",
        label: "직전학기 평점",
        met: false,
        detail: `기준 ${eligibility.gpa_recent_min}점 이상 / 내 성적 ${profile.gpa_recent}점`,
        actionHint: "직전 학기 성적을 더 올려보세요.",
      });
    } else {
      if (profile.gpa_recent - eligibility.gpa_recent_min <= 0.1) {
        reasons.push("성적이 기준에 아슬아슬해 성적 확정 후 재확인이 필요합니다.");
      }
      criteria.push({
        key: "gpa_recent",
        label: "직전학기 평점",
        met: true,
        detail: `기준 ${eligibility.gpa_recent_min}점 이상 / 내 성적 ${profile.gpa_recent}점`,
      });
    }
  }

  // 누적 평점
  if (eligibility.gpa_cumulative_min != null) {
    if (profile.gpa_cumulative == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("전체 GPA 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "gpa_cumulative",
        label: "누적 평점",
        met: false,
        detail: `기준 ${eligibility.gpa_cumulative_min}점 이상 / 내 성적 정보 없음`,
        actionHint: "성적증명서 정보를 다시 확인해주세요.",
      });
    } else if (profile.gpa_cumulative < eligibility.gpa_cumulative_min) {
      status = "지원불가";
      unmetConditions.push("누적 GPA 미달");
      reasons.push(`전체 평점 기준 ${eligibility.gpa_cumulative_min}점이지만 현재 ${profile.gpa_cumulative}점입니다.`);
      criteria.push({
        key: "gpa_cumulative",
        label: "누적 평점",
        met: false,
        detail: `기준 ${eligibility.gpa_cumulative_min}점 이상 / 내 성적 ${profile.gpa_cumulative}점`,
        actionHint: "누적 평점을 더 올려보세요.",
      });
    } else {
      criteria.push({
        key: "gpa_cumulative",
        label: "누적 평점",
        met: true,
        detail: `기준 ${eligibility.gpa_cumulative_min}점 이상 / 내 성적 ${profile.gpa_cumulative}점`,
      });
    }
  }

  // 직전학기 이수학점
  if (eligibility.credits_recent_min != null) {
    if (profile.credits_recent == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("직전학기 이수학점 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "credits_recent",
        label: "직전학기 이수학점",
        met: false,
        detail: `기준 ${eligibility.credits_recent_min}학점 이상 / 내 이수학점 정보 없음`,
        actionHint: "성적증명서 정보를 다시 확인해주세요.",
      });
    } else if (profile.credits_recent < eligibility.credits_recent_min) {
      status = "지원불가";
      unmetConditions.push("직전학기 이수학점 미달");
      reasons.push(
        `직전학기 이수학점 기준 ${eligibility.credits_recent_min}학점이지만 현재 ${profile.credits_recent}학점으로 확인되어 지원이 어렵습니다.`,
      );
      criteria.push({
        key: "credits_recent",
        label: "직전학기 이수학점",
        met: false,
        detail: `기준 ${eligibility.credits_recent_min}학점 이상 / 내 이수학점 ${profile.credits_recent}학점`,
        actionHint: "이수학점을 더 채워보세요.",
      });
    } else {
      if (profile.credits_recent - eligibility.credits_recent_min <= 1) {
        reasons.push("이수학점이 기준에 가까워 재확인이 필요합니다.");
      }
      criteria.push({
        key: "credits_recent",
        label: "직전학기 이수학점",
        met: true,
        detail: `기준 ${eligibility.credits_recent_min}학점 이상 / 내 이수학점 ${profile.credits_recent}학점`,
      });
    }
  }

  // 소득구간
  if (eligibility.income_bracket_max != null) {
    if (profile.income_bracket == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("소득구간이 입력되지 않아 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "income_bracket",
        label: "소득구간",
        met: false,
        detail: `기준 ${eligibility.income_bracket_max}구간 이하 / 내 소득구간 정보 없음`,
        actionHint: "소득분위 정보를 입력해주세요.",
      });
    } else if (profile.income_bracket > eligibility.income_bracket_max) {
      status = "지원불가";
      unmetConditions.push("소득구간 초과");
      reasons.push(
        `소득구간 기준 ${eligibility.income_bracket_max}구간 이하이지만 현재 ${profile.income_bracket}구간으로 확인되어 지원이 어렵습니다.`,
      );
      criteria.push({
        key: "income_bracket",
        label: "소득구간",
        met: false,
        detail: `기준 ${eligibility.income_bracket_max}구간 이하 / 내 소득구간 ${profile.income_bracket}구간`,
        actionHint: "한국장학재단 소득분위 재산정 여부를 확인해보세요.",
      });
    } else {
      criteria.push({
        key: "income_bracket",
        label: "소득구간",
        met: true,
        detail: `기준 ${eligibility.income_bracket_max}구간 이하 / 내 소득구간 ${profile.income_bracket}구간`,
      });
    }
  }

  // 특수신분
  if (eligibility.special_status.length > 0) {
    const matched = eligibility.special_status.filter((item) => profile.special_status.includes(item));
    const met = matched.length > 0;
    if (!met) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push(`특수신분 조건(${eligibility.special_status.join(", ")}) 확인이 필요합니다.`);
    }
    criteria.push({
      key: "special_status",
      label: "특수신분 조건",
      met,
      detail: met
        ? `요구 조건(${eligibility.special_status.join(", ")}) 중 보유: ${matched.join(", ")}`
        : `요구 조건: ${eligibility.special_status.join(", ")} — 해당 없음`,
      actionHint: met ? undefined : "해당 특수신분 관련 서류·활동 이력을 준비해보세요.",
    });
  }

  if (scholarship.eligibility.other_conditions) {
    reasons.push(scholarship.eligibility.other_conditions);
  }

  const score =
    computeBaseScore(status) + computeMarginScore(profile, scholarship) + computeMatchBonus(profile, scholarship);

  return {
    scholarship_id: scholarship.id,
    status,
    reason_text: reasons[0] ?? "조건을 검토했습니다.",
    unmet_conditions: unmetConditions.length > 0 ? unmetConditions : undefined,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    criteria,
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

// Parses "OO시/구/군 [관내] [연속] N년 이상 [계속] 거주" style free text into a
// district name + minimum years. Matches the region_requirement phrasing actually
// used in the seed data ("강남구 관내 연속 1년 이상 거주", "수원시 2년 이상 계속
// 거주" 등). Returns null for anything else (OR conditions, "서울 소재 대학
// 재학" 등) — those get surfaced as "조건부가능, 직접 확인" rather than guessed.
function parseRegionRequirement(text: string): { district: string; minYears: number } | null {
  const match = text.match(/([가-힣]{2,6}(?:시|군|구))\s*(?:관내\s*)?(?:연속\s*)?([0-9]+)\s*년\s*이상\s*(?:계속\s*)?거주/);
  if (!match) return null;
  return { district: match[1], minYears: Number(match[2]) };
}

// Pulls explicit grade digits (1-4) out of free-text grade_level descriptions. Handles comma
// lists sharing a single trailing "학년" ("2, 3, 4학년"), ranges ("2~4학년"), and "이상"
// ("3학년 이상"). A negative lookbehind on "-\d" avoids misreading semester notation like
// "4-1학년" (4th year, 1st semester) as "grade 1". Returns an empty set when nothing reliable
// can be parsed (e.g. "전학년", "학부 재학생") — callers should treat that as "no restriction",
// not as "reject everyone", since a bare string-equality check would otherwise always fail.
function extractGradeDigits(text: string): Set<string> {
  const digits = new Set<string>();
  const segmentPattern = /(?<![-\d])(?:[1-4]\s*[,·]\s*)+[1-4]\s*학년|(?<![-\d])[1-4]\s*학년/g;
  for (const segment of text.match(segmentPattern) ?? []) {
    for (const digit of segment.match(/[1-4]/g) ?? []) digits.add(digit);
  }

  const aboveMatch = text.match(/(?<![-\d])([1-4])\s*학년\s*이상/);
  if (aboveMatch) {
    for (let grade = Number(aboveMatch[1]); grade <= 4; grade += 1) digits.add(String(grade));
  }

  const rangeMatch = text.match(/(?<![-\d])([1-4])\s*[~-]\s*([1-4])\s*학년/);
  if (rangeMatch) {
    for (let grade = Number(rangeMatch[1]); grade <= Number(rangeMatch[2]); grade += 1) digits.add(String(grade));
  }

  return digits;
}
