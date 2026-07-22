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

  // 누적 평점 — a few scholarships (서울인재대학, 서울인재해외교환학생, 현대차 CMK,
  // 수림재단[자연계]) express this on a 100점 백분위 scale instead of the usual 4.5
  // GPA scale (eligibility.gpa_scale marks which). The onboarding transcript already
  // captures both (profile.gpa_cumulative on 4.5, profile.percentile_cumulative on
  // 100), so pick whichever matches the requirement instead of always comparing a
  // 4.5-scale number against a 100-point threshold, which used to always read as a
  // huge shortfall (e.g. "4.3 < 90") and reject every student regardless of merit.
  if (eligibility.gpa_cumulative_min != null) {
    const use100Scale = eligibility.gpa_scale === 100;
    const percentileCumulative = (profile as unknown as { percentile_cumulative?: number | null }).percentile_cumulative ?? null;
    const studentScore = use100Scale ? percentileCumulative : profile.gpa_cumulative;
    const scaleLabel = use100Scale ? "백분위" : "평점";

    if (studentScore == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push(`전체 ${scaleLabel} 정보가 없어 조건부 가능으로 분류했습니다.`);
      criteria.push({
        key: "gpa_cumulative",
        label: "누적 평점",
        met: false,
        detail: `기준 ${scaleLabel} ${eligibility.gpa_cumulative_min}점 이상 / 내 ${scaleLabel} 정보 없음`,
        actionHint: "성적증명서 정보를 다시 확인해주세요.",
      });
    } else if (studentScore < eligibility.gpa_cumulative_min) {
      status = "지원불가";
      unmetConditions.push("누적 GPA 미달");
      reasons.push(`전체 ${scaleLabel} 기준 ${eligibility.gpa_cumulative_min}점이지만 현재 ${studentScore}점입니다.`);
      criteria.push({
        key: "gpa_cumulative",
        label: "누적 평점",
        met: false,
        detail: `기준 ${scaleLabel} ${eligibility.gpa_cumulative_min}점 이상 / 내 ${scaleLabel} ${studentScore}점`,
        actionHint: "누적 평점을 더 올려보세요.",
      });
    } else {
      criteria.push({
        key: "gpa_cumulative",
        label: "누적 평점",
        met: true,
        detail: `기준 ${scaleLabel} ${eligibility.gpa_cumulative_min}점 이상 / 내 ${scaleLabel} ${studentScore}점`,
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

  // 특수신분 — the onboarding UI splits this across two separate screens: a
  // free-text-ish requirement in the seed data ("장애인복지법 제32조 중증장애인
  // 등록자", "국가유공자 본인 또는 자녀" 등) needs to be compared against short chip
  // labels ("중증장애인", "국가유공자") plus the low-income select (기초생활수급/
  // 차상위/한부모), which never made it into profile.special_status at all. Exact
  // string equality between those two shapes could basically never match. Both
  // sides are now normalized into the same canonical category tokens below.
  if (eligibility.special_status.length > 0) {
    const profileTokens = resolveProfileSpecialStatusTokens(profile);
    const perEntry = eligibility.special_status.map((entry) => ({
      entry,
      required: detectSpecialStatusCategories(entry),
    }));
    const matchedEntries = perEntry.filter((item) => item.required.some((token) => profileTokens.has(token)));
    const unparseableEntries = perEntry.filter((item) => item.required.length === 0);
    const met = matchedEntries.length > 0;

    if (!met && unparseableEntries.length > 0) {
      // Every listed condition failed to resolve to a known category (e.g. "기준중위소득
      // 60% 이하", which no onboarding question captures) — can't confidently rule the
      // student out, so ask them to double-check instead of a false rejection.
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push(`특수신분 조건(${eligibility.special_status.join(", ")})을 자동으로 판별하기 어려워 조건부 가능으로 분류했습니다.`);
      criteria.push({
        key: "special_status",
        label: "특수신분 조건",
        met: false,
        detail: `요구 조건: ${eligibility.special_status.join(", ")} — 자동 판별이 어려워요.`,
        actionHint: "공식 공고에서 특수신분 조건을 직접 확인해주세요.",
      });
    } else if (!met) {
      // At least one condition was confidently parsed and the student's answered
      // status doesn't cover it — this is a definitive mismatch, not a guess, so
      // it should drop out of ELIGIBLE/CONDITIONAL rather than staying "조건부가능"
      // forever regardless of what the student actually selected.
      status = "지원불가";
      unmetConditions.push(`특수신분 조건(${eligibility.special_status.join(", ")}) 미충족`);
      reasons.push(`특수신분 조건(${eligibility.special_status.join(", ")})에 해당하지 않습니다.`);
      criteria.push({
        key: "special_status",
        label: "특수신분 조건",
        met: false,
        detail: `요구 조건: ${eligibility.special_status.join(", ")} — 해당 없음`,
        actionHint: "해당 특수신분에 변동이 생기면 다시 확인해보세요.",
      });
    } else {
      criteria.push({
        key: "special_status",
        label: "특수신분 조건",
        met: true,
        detail: `요구 조건(${eligibility.special_status.join(", ")}) 중 보유: ${matchedEntries.map((item) => item.entry).join(", ")}`,
      });
    }
  }

  // 전공 요건 — only one scholarship in the seed data has this (화학·바이오·화장품
  // 관련 학과), but nothing was ever checking it, so it silently passed for every major.
  if (eligibility.major_requirement) {
    const keywords = parseMajorKeywords(eligibility.major_requirement);
    const studentMajor = profile.major ?? "";
    if (!studentMajor) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("전공 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "major",
        label: "전공 조건",
        met: false,
        detail: `요구 전공: ${eligibility.major_requirement} / 내 전공 정보 없음`,
        actionHint: "성적증명서에서 학과 정보를 확인해주세요.",
      });
    } else {
      const met = keywords.length === 0 || keywords.some((keyword) => studentMajor.includes(keyword));
      if (!met) {
        status = "지원불가";
        unmetConditions.push(`전공 조건(${eligibility.major_requirement}) 미충족`);
        reasons.push(`전공 조건(${eligibility.major_requirement})에 해당하지 않습니다.`);
      }
      criteria.push({
        key: "major",
        label: "전공 조건",
        met,
        detail: `요구 전공: ${eligibility.major_requirement} / 내 전공: ${studentMajor}`,
        actionHint: met ? undefined : "전공이 바뀌면 다시 확인해보세요.",
      });
    }
  }

  // 국가장학금 신청 필수 — a few scholarships require the student to have gone
  // through the 국가장학금(한국장학재단) application first (e.g. to get an official
  // 소득구간 determination). other_conditions text merely *mentioning* "국가장학금"
  // isn't a reliable enough signal on its own (some scholarships just note it as an
  // allowed combination, not a requirement), so this only fires on the specific
  // "신청 필수"/"신청 후" phrasing actually used for a real requirement.
  const otherConditionsText = scholarship.eligibility.other_conditions ?? "";
  if (/국가장학금[가-힣()0-9·\s]{0,10}신청\s*(?:필수|후)/.test(otherConditionsText)) {
    const applied = (profile as unknown as { nationalScholarshipApplied?: boolean | null }).nationalScholarshipApplied ?? null;
    if (applied == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("국가장학금 신청 여부가 확인되지 않아 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "national_scholarship",
        label: "국가장학금 신청",
        met: false,
        detail: "이 장학금은 국가장학금(한국장학재단) 신청이 필수예요. 신청 여부 정보가 없어요.",
        actionHint: "온보딩에서 현재 수혜 중인 장학금 정보를 확인해주세요.",
      });
    } else if (!applied) {
      status = "지원불가";
      unmetConditions.push("국가장학금 미신청");
      reasons.push("이 장학금은 국가장학금 신청이 필수인데, 아직 신청하지 않은 것으로 확인됩니다.");
      criteria.push({
        key: "national_scholarship",
        label: "국가장학금 신청",
        met: false,
        detail: "이 장학금은 국가장학금(한국장학재단) 신청이 필수예요.",
        actionHint: "국가장학금을 먼저 신청해주세요.",
      });
    } else {
      criteria.push({
        key: "national_scholarship",
        label: "국가장학금 신청",
        met: true,
        detail: "국가장학금 신청/수혜 이력이 확인됩니다.",
      });
    }
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
  const profileTokens = resolveProfileSpecialStatusTokens(profile);
  const matches = scholarship.eligibility.special_status.filter((entry) =>
    detectSpecialStatusCategories(entry).some((token) => profileTokens.has(token)),
  ).length;
  const activityMatches = (profile.activities ?? []).filter((activity) =>
    scholarship.notes ? scholarship.notes.includes(activity) : false,
  ).length;
  return Math.min(20, matches * 5 + activityMatches * 3);
}

// Maps the onboarding "저소득 유형" select (기초생활수급/차상위/한부모/해당없음) onto
// the same canonical category names used elsewhere so the two data sources agree.
const LOW_INCOME_TYPE_TO_CATEGORY: Record<string, string> = {
  기초생활수급: "기초생활수급자",
  차상위: "차상위계층",
  한부모: "한부모",
};

// profile.special_status only ever holds the special-status chip picks (중증장애인,
// 국가유공자 등); the low-income select lives in a sibling field and was never folded
// in. Merge them here so every caller (live onboarding preview and already-saved
// profiles read back from the DB) benefits without needing a data migration.
function resolveProfileSpecialStatusTokens(profile: StudentProfile): Set<string> {
  const tokens = new Set<string>();
  for (const item of profile.special_status ?? []) {
    if (item && item !== "해당없음") tokens.add(item);
  }
  const lowIncomeType = (profile as unknown as { low_income_type?: string | null }).low_income_type;
  if (lowIncomeType && LOW_INCOME_TYPE_TO_CATEGORY[lowIncomeType]) {
    tokens.add(LOW_INCOME_TYPE_TO_CATEGORY[lowIncomeType]);
  }
  return tokens;
}

// Extracts known special-status categories out of a scholarship's free-text
// requirement ("장애인복지법 제32조 중증장애인 등록자", "국가유공자 본인 또는 자녀" 등)
// so it can be compared against the short chip-label tokens above instead of
// requiring byte-for-byte string equality. Returns an empty array when nothing
// recognizable is found (e.g. "기준중위소득 60% 이하") — callers should treat that
// as "can't tell" rather than "doesn't match".
function detectSpecialStatusCategories(text: string): string[] {
  const found: string[] = [];
  const hasBasicLivelihood = /기초생활수급/.test(text);
  const hasNearPoverty = /차상위/.test(text);
  const nearPovertyExcluded = /차상위[가-힣]*\s*(?:은|는)\s*미해당|차상위[가-힣]*\s*제외/.test(text);

  if (hasBasicLivelihood) found.push("기초생활수급자");
  if (hasNearPoverty && !nearPovertyExcluded) found.push("차상위계층");
  if (/한부모/.test(text)) found.push("한부모");
  if (/중증\s*장애/.test(text)) found.push("중증장애인");
  else if (/장애인/.test(text)) found.push("장애인");
  if (/국가유공자/.test(text)) found.push("국가유공자");
  if (/독립유공자/.test(text) && /후손|자손|증손|현손/.test(text)) found.push("독립유공자후손");
  if (/보훈대상자/.test(text)) found.push("보훈대상자");
  if (/탈북민|북한이탈/.test(text)) found.push("탈북민");
  if (/다문화/.test(text)) found.push("다문화");
  if (/이주배경|재한외국인/.test(text)) found.push("이주배경");
  if (/자립준비청년/.test(text)) found.push("자립준비청년");
  if (/가족돌봄/.test(text)) found.push("가족돌봄");
  if (/다자녀/.test(text)) found.push("다자녀");
  if (/LH\s*임대주택/.test(text)) found.push("LH임대주택거주");
  if (/건강보험료/.test(text)) found.push("건강보험료");
  if (/재산세/.test(text)) found.push("재산세");

  return Array.from(new Set(found));
}

// Splits a major requirement like "화학·바이오·화장품 관련 학과" into loose keywords
// ("화학", "바이오", "화장품") checked as substrings against the student's department
// text, since department names rarely match the requirement phrasing verbatim.
function parseMajorKeywords(text: string): string[] {
  return text
    .replace(/관련\s*학과|전공|계열/g, " ")
    .split(/[·,\/\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
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
