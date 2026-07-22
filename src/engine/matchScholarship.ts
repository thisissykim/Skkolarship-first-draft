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
  // profile.currentScholarships (camelCase, {type,name}[]) is declared on the base
  // StudentProfile type, but StudentProfileFull — the shape every real onboarding
  // profile actually is — explicitly Omits it and stores this as current_scholarships
  // (snake_case, category strings like "교외재단/기업") instead. So `profile.currentScholarships`
  // has always read as undefined for real users, meaning the "중복수혜 불가" block below
  // silently never fired for anyone. Reading the field that's actually populated instead.
  const currentScholarshipCategories =
    (profile as unknown as { current_scholarships?: string[] }).current_scholarships ?? [];
  const externalFundingCategories = currentScholarshipCategories.filter(
    (category) => category === "교외재단/기업" || category === "부모직장학자금지원",
  );

  // 중복 수혜 — the onboarding answer is a coarse category, not a type-matched
  // scholarship record, so an external-funding conflict can't be confirmed as
  // definitely the SAME type (등록금성/생활비성) as this scholarship — surfaced as
  // "조건부가능, 직접 확인" rather than a confident 지원불가.
  if (scholarship.duplicate_conflict.allows_other_scholarships === "불가") {
    if (externalFundingCategories.length > 0) {
      // First possible status mutation in the function — nothing to preserve yet.
      status = "조건부가능";
      const detail = `현재 받고 있는 ${externalFundingCategories.join(", ")}과 중복 수혜가 가능한지 확인이 필요합니다.`;
      reasons.push(detail);
      criteria.push({
        key: "duplicate_conflict",
        label: "중복 수혜 여부",
        met: false,
        detail: `이 장학금은 중복 수혜가 불가능해요. 현재 수혜 중: ${externalFundingCategories.join(", ")}`,
        actionHint: "재단/기관에 중복 수혜 가능 여부를 직접 확인해주세요.",
      });
    } else {
      criteria.push({
        key: "duplicate_conflict",
        label: "중복 수혜 여부",
        met: true,
        detail: "현재 수혜 중인 외부 장학금이 없어 중복 조건에 해당하지 않습니다.",
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

  // 재학 상태 제외(휴학/교환학생파견/초과학기/마지막학기) — often phrased as a list
  // ("휴학·교환·초과학기·졸업유예 제외") sharing one trailing marker rather than a
  // structured field, so this scans for status keywords near any "제외"/"불가"
  // marker instead of requiring the keyword to sit immediately before it.
  const excludedStatuses = detectEnrollmentExclusions(`${eligibility.grade_level ?? ""} ${eligibility.other_conditions ?? ""}`);
  if (excludedStatuses.size > 0) {
    const enrollmentStatus =
      (profile as unknown as { next_semester_status?: string | null }).next_semester_status ??
      profile.enrollmentStatus ??
      null;
    if (enrollmentStatus && excludedStatuses.has(enrollmentStatus)) {
      status = "지원불가";
      unmetConditions.push(`재학 상태(${enrollmentStatus}) 제외 대상`);
      reasons.push(`${enrollmentStatus} 상태는 이 장학금 지원 대상에서 제외돼요.`);
      criteria.push({
        key: "enrollment_status",
        label: "재학 상태",
        met: false,
        detail: `제외 대상: ${Array.from(excludedStatuses).join(", ")} / 내 다음학기 상태: ${enrollmentStatus}`,
        actionHint: "재학 상태가 바뀌면 다시 확인해보세요.",
      });
    } else if (enrollmentStatus) {
      criteria.push({
        key: "enrollment_status",
        label: "재학 상태",
        met: true,
        detail: `제외 대상: ${Array.from(excludedStatuses).join(", ")} / 내 다음학기 상태(${enrollmentStatus})는 해당하지 않아요.`,
      });
    }
  }

  // 거주 지역 — the seed data has real region_requirement text ("강남구 관내
  // 연속 1년 이상 거주" 등) and onboarding collects profile.region, but nothing
  // was ever connecting the two, so residency-only scholarships (구청/시 장학금)
  // always fell through as ELIGIBLE regardless of where the student lives.
  if (eligibility.region_requirement) {
    // "OO 소재 대학 재학" is a university-location requirement, not a residence one,
    // so it doesn't need profile.region at all. 성균관대학교는 학과가 서울(인문사회)
    // 캠퍼스든 수원(자연과학) 캠퍼스든 관계없이 "서울 소재 대학"으로 인정되는 학교라
    // 이 앱의 모든 사용자(성균관대 재학생)는 이 조건을 항상 충족한다.
    const universityLocationMatch = eligibility.region_requirement.match(/([가-힣]{2,4})\s*소재\s*대학\s*재학/);
    const schoolName = (profile as unknown as { school_name?: string | null }).school_name ?? null;

    if (universityLocationMatch && universityLocationMatch[1] === "서울" && schoolName && /성균관대학교/.test(schoolName)) {
      criteria.push({
        key: "region",
        label: "거주 지역",
        met: true,
        detail: `요구 지역: ${eligibility.region_requirement} / 성균관대학교 재학생은 캠퍼스와 무관하게 서울 소재 대학 재학 조건을 충족해요.`,
      });
    } else {
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
  }

  // 직전학기 평점 — a couple of scholarships (푸른등대 두나무, 청년창업농장학금) state
  // this as a 100점 백분위 requirement rather than the usual 4.5 GPA scale, same as
  // the cumulative-GPA case. The transcript parser doesn't currently extract a
  // recent-semester percentile (only percentile_cumulative), so this safely falls
  // through to "정보 없음 → 조건부가능" for those two until that data exists, rather
  // than comparing a 4.5-scale number against a 100-point threshold.
  //
  // Two scholarships explicitly waive this GPA bar for specific groups — checked here
  // (before the block runs) rather than patched afterward, so a waived student never
  // sees a contradictory "미달" reason alongside an overridden 지원가능 status:
  // - 국가유공자(자녀)장학금: "국가유공자 본인·신입생 제외"
  // - 국가근로장학금: "장애인·자립준비청년은 성적기준 예외"
  const isRecentGpaExempt =
    (scholarship.id === "skku-gukga-yugongja" && profile.grade_level === "1") ||
    (scholarship.id === "ext-gukga-geunro" &&
      (() => {
        const tokens = resolveProfileSpecialStatusTokens(profile);
        return tokens.has("장애인") || tokens.has("중증장애인") || tokens.has("자립준비청년");
      })());

  if (eligibility.gpa_recent_min != null && !isRecentGpaExempt) {
    const useRecent100Scale = eligibility.gpa_scale === 100;
    const percentileRecent = (profile as unknown as { percentile_recent?: number | null }).percentile_recent ?? null;
    const recentScore = useRecent100Scale ? percentileRecent : profile.gpa_recent;
    const recentScaleLabel = useRecent100Scale ? "백분위" : "평점";

    if (recentScore == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push(`직전학기 ${recentScaleLabel} 정보가 없어 조건부 가능으로 분류했습니다.`);
      criteria.push({
        key: "gpa_recent",
        label: "직전학기 평점",
        met: false,
        detail: `기준 ${recentScaleLabel} ${eligibility.gpa_recent_min}점 이상 / 내 ${recentScaleLabel} 정보 없음`,
        actionHint: "성적증명서 정보를 다시 확인해주세요.",
      });
    } else if (recentScore < eligibility.gpa_recent_min) {
      status = "지원불가";
      unmetConditions.push("직전학기 GPA 미달");
      reasons.push(
        `직전학기 ${recentScaleLabel} 기준 ${eligibility.gpa_recent_min}점이지만 현재 ${recentScore}점으로 확인되어 지원이 어렵습니다.`,
      );
      criteria.push({
        key: "gpa_recent",
        label: "직전학기 평점",
        met: false,
        detail: `기준 ${recentScaleLabel} ${eligibility.gpa_recent_min}점 이상 / 내 ${recentScaleLabel} ${recentScore}점`,
        actionHint: "직전 학기 성적을 더 올려보세요.",
      });
    } else {
      if (!useRecent100Scale && recentScore - eligibility.gpa_recent_min <= 0.1) {
        reasons.push("성적이 기준에 아슬아슬해 성적 확정 후 재확인이 필요합니다.");
      }
      criteria.push({
        key: "gpa_recent",
        label: "직전학기 평점",
        met: true,
        detail: `기준 ${recentScaleLabel} ${eligibility.gpa_recent_min}점 이상 / 내 ${recentScaleLabel} ${recentScore}점`,
      });
    }
  } else if (eligibility.gpa_recent_min != null && isRecentGpaExempt) {
    criteria.push({
      key: "gpa_recent",
      label: "직전학기 평점",
      met: true,
      detail: `기준 ${eligibility.gpa_recent_min}점 이상이지만 해당 조건에서 면제돼요.`,
    });
  }

  // 누적 평점 — a few scholarships (서울인재대학, 서울인재해외교환학생, 현대차 CMK,
  // 수림재단[자연계]) express this on a 100점 백분위 scale instead of the usual 4.5
  // GPA scale (eligibility.gpa_scale marks which). The onboarding transcript already
  // captures both (profile.gpa_cumulative on 4.5, profile.percentile_cumulative on
  // 100), so pick whichever matches the requirement instead of always comparing a
  // 4.5-scale number against a 100-point threshold, which used to always read as a
  // huge shortfall (e.g. "4.3 < 90") and reject every student regardless of merit.
  // gpa_condition_grades restricts this whole check to specific grade_level digits
  // (e.g. 인문100년장학금: only 3학년 has a GPA bar at all, 1학년 is exempt). Null
  // means "applies whenever gpa_cumulative_min is set", the same as before this
  // field existed.
  const gpaConditionApplies =
    !eligibility.gpa_condition_grades ||
    eligibility.gpa_condition_grades.length === 0 ||
    (profile.grade_level != null && eligibility.gpa_condition_grades.includes(profile.grade_level));

  if (eligibility.gpa_cumulative_min != null && gpaConditionApplies) {
    // gpa_cumulative_min_alt is an OR-alternative on a possibly different scale
    // (e.g. "백분위 90점 또는 평점 3.6/4.5 이상") — met if EITHER threshold clears.
    const branches = [{ threshold: eligibility.gpa_cumulative_min, scale: eligibility.gpa_scale }];
    if (eligibility.gpa_cumulative_min_alt != null && eligibility.gpa_scale_alt != null) {
      branches.push({ threshold: eligibility.gpa_cumulative_min_alt, scale: eligibility.gpa_scale_alt });
    }

    const percentileCumulative = (profile as unknown as { percentile_cumulative?: number | null }).percentile_cumulative ?? null;
    const resolved = branches.map((branch) => {
      const scaleLabel = branch.scale === 100 ? "백분위" : "평점";
      const score = branch.scale === 100 ? percentileCumulative : profile.gpa_cumulative;
      return { ...branch, scaleLabel, score };
    });

    const metBranch = resolved.find((branch) => branch.score != null && branch.score >= branch.threshold);
    const unknownBranches = resolved.filter((branch) => branch.score == null);
    const requirementText = resolved.map((branch) => `${branch.scaleLabel} ${branch.threshold}점 이상`).join(" 또는 ");

    if (metBranch) {
      criteria.push({
        key: "gpa_cumulative",
        label: "누적 평점",
        met: true,
        detail: `기준 ${requirementText} / 내 ${metBranch.scaleLabel} ${metBranch.score}점`,
      });
    } else if (unknownBranches.length > 0) {
      // At least one OR-branch couldn't be evaluated (missing score for that scale) —
      // can't confidently rule the student out via the branches we could check.
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push(`전체 성적 정보가 부족해 조건부 가능으로 분류했습니다. (기준: ${requirementText})`);
      criteria.push({
        key: "gpa_cumulative",
        label: "누적 평점",
        met: false,
        detail: `기준 ${requirementText} / 정보 부족: ${unknownBranches.map((b) => b.scaleLabel).join(", ")} 정보 없음`,
        actionHint: "성적증명서 정보를 다시 확인해주세요.",
      });
    } else {
      status = "지원불가";
      unmetConditions.push("누적 GPA 미달");
      const detail = resolved.map((b) => `${b.scaleLabel} ${b.score}점`).join(" / ");
      reasons.push(`전체 성적 기준(${requirementText})에 못 미칩니다. 현재 ${detail}.`);
      criteria.push({
        key: "gpa_cumulative",
        label: "누적 평점",
        met: false,
        detail: `기준 ${requirementText} / 내 성적 ${detail}`,
        actionHint: "누적 평점을 더 올려보세요.",
      });
    }
  }

  // 직전학기 이수학점 — 7 of the 8 scholarships that carry credits_recent_min_last_semester
  // share the exact same pair (12학점 / 9학점) despite being otherwise unrelated
  // scholarships, which reads as a shared SKKU-wide clause ("직전학기 12학점 이상,
  // 단 최종학기(졸업예정) 재학생은 9학점 이상") rather than per-scholarship numbers —
  // confirmed against 정용지 창의장학생's actual announcement. 정인장학금 only has the
  // "last_semester" field with no normal threshold at all, so there it's used as the
  // single plain requirement instead of a graduating-semester exception.
  const isGraduatingSemester =
    (profile as unknown as { next_semester_status?: string | null }).next_semester_status === "졸업예정";
  const creditsThreshold =
    eligibility.credits_recent_min != null && eligibility.credits_recent_min_last_semester != null
      ? isGraduatingSemester
        ? eligibility.credits_recent_min_last_semester
        : eligibility.credits_recent_min
      : (eligibility.credits_recent_min ?? eligibility.credits_recent_min_last_semester);

  if (creditsThreshold != null) {
    if (profile.credits_recent == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("직전학기 이수학점 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "credits_recent",
        label: "직전학기 이수학점",
        met: false,
        detail: `기준 ${creditsThreshold}학점 이상 / 내 이수학점 정보 없음`,
        actionHint: "성적증명서 정보를 다시 확인해주세요.",
      });
    } else if (profile.credits_recent < creditsThreshold) {
      status = "지원불가";
      unmetConditions.push("직전학기 이수학점 미달");
      reasons.push(
        `직전학기 이수학점 기준 ${creditsThreshold}학점이지만 현재 ${profile.credits_recent}학점으로 확인되어 지원이 어렵습니다.`,
      );
      criteria.push({
        key: "credits_recent",
        label: "직전학기 이수학점",
        met: false,
        detail: `기준 ${creditsThreshold}학점 이상 / 내 이수학점 ${profile.credits_recent}학점`,
        actionHint: "이수학점을 더 채워보세요.",
      });
    } else {
      if (profile.credits_recent - creditsThreshold <= 1) {
        reasons.push("이수학점이 기준에 가까워 재확인이 필요합니다.");
      }
      criteria.push({
        key: "credits_recent",
        label: "직전학기 이수학점",
        met: true,
        detail: `기준 ${creditsThreshold}학점 이상 / 내 이수학점 ${profile.credits_recent}학점`,
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

  // 단과대학 요건 — grade_level text often names the college directly ("사회과학대학
  // 재학생") but nothing was checking it against the student's actual college, only
  // silently dropping it during grade-digit parsing. transcript.college is already
  // extracted during upload.
  if (eligibility.college_requirement) {
    const studentCollege = (profile as unknown as { college?: string | null }).college ?? "";
    if (!studentCollege) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("소속 단과대학 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "college",
        label: "소속 단과대학",
        met: false,
        detail: `요구 단과대학: ${eligibility.college_requirement} / 내 단과대학 정보 없음`,
        actionHint: "성적증명서에서 단과대학 정보를 확인해주세요.",
      });
    } else {
      const met = studentCollege.includes(eligibility.college_requirement);
      if (!met) {
        status = "지원불가";
        unmetConditions.push(`단과대학 조건(${eligibility.college_requirement}) 미충족`);
        reasons.push(`단과대학 조건(${eligibility.college_requirement})에 해당하지 않습니다.`);
      }
      criteria.push({
        key: "college",
        label: "소속 단과대학",
        met,
        detail: `요구 단과대학: ${eligibility.college_requirement} / 내 단과대학: ${studentCollege}`,
        actionHint: met ? undefined : "소속 단과대학이 바뀌면 다시 확인해보세요.",
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

  // 조건부 추가질문 게이트 — onboarding's CONDITIONAL_TRIGGERS system asks a small,
  // hand-verified subset of scholarships' free-text requirements (전공계열, 진로
  // 희망, 교환학생 예정, 신입생 여부 등) directly, since these can't be reliably
  // derived from any other structured field. See CONDITIONAL_GATES below for the
  // exact requirement text each gate maps to.
  const conditionalGates = CONDITIONAL_GATES[scholarship.id];
  if (conditionalGates) {
    const conditionalAnswers = (profile as unknown as { conditional_answers?: Record<string, boolean> }).conditional_answers ?? {};
    for (const gate of conditionalGates) {
      const answer = conditionalAnswers[gate.questionId];
      const key = `conditional_${gate.questionId}_${scholarship.id}`;
      if (answer === undefined) {
        status = status === "지원불가" ? status : "조건부가능";
        reasons.push(`${gate.label} 확인이 필요해 조건부 가능으로 분류했습니다.`);
        criteria.push({
          key,
          label: gate.label,
          met: false,
          detail: `${gate.requirementText} 아직 답변하지 않았어요.`,
          actionHint: "온보딩 추가 확인 질문에서 답변해주세요.",
        });
      } else {
        const met = answer === gate.requireTrue;
        if (!met) {
          status = "지원불가";
          unmetConditions.push(`${gate.label} 미충족`);
          reasons.push(gate.requirementText);
        }
        criteria.push({ key, label: gate.label, met, detail: gate.requirementText });
      }
    }
  }

  // 희망 진로 체크박스 게이트 — 체크박스로 직접 선택한 항목이라 확인 질문 없이 바로 판별.
  const careerGate = CAREER_INTEREST_GATES[scholarship.id];
  if (careerGate) {
    const careerInterests = (profile as unknown as { career_interests?: string[] }).career_interests ?? [];
    const met = careerInterests.includes(careerGate.interest);
    if (!met) {
      status = "지원불가";
      unmetConditions.push(`${careerGate.interest} 진로 희망 아님`);
      reasons.push(careerGate.requirementText);
    }
    criteria.push({
      key: "career_interest",
      label: "희망 진로",
      met,
      detail: met ? careerGate.requirementText : `${careerGate.requirementText} 온보딩에서 해당 진로를 선택하지 않았어요.`,
    });
  }

  // 외국인전형 입학자 제외 / 대한민국 국적자 필요
  if (detectForeignExclusion(`${eligibility.grade_level ?? ""} ${eligibility.other_conditions ?? ""}`)) {
    const nationality = (profile as unknown as { nationality?: string | null }).nationality ?? null;
    if (!nationality) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("국적 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "nationality",
        label: "국적",
        met: false,
        detail: "이 장학금은 외국인전형 입학자는 지원할 수 없어요. 국적 정보가 없어요.",
        actionHint: "온보딩에서 국적 정보를 입력해주세요.",
      });
    } else if (nationality === "외국인") {
      status = "지원불가";
      unmetConditions.push("외국인전형/외국인 제외 대상");
      reasons.push("이 장학금은 외국인전형 입학자는 지원할 수 없어요.");
      criteria.push({
        key: "nationality",
        label: "국적",
        met: false,
        detail: "이 장학금은 외국인전형 입학자는 지원할 수 없어요.",
      });
    } else {
      criteria.push({
        key: "nationality",
        label: "국적",
        met: true,
        detail: `외국인전형 입학자는 제외되는 조건인데, 내 국적(${nationality})은 해당하지 않아요.`,
      });
    }
  }

  // 직전학기 과락(F) 없어야 함 — has_f_grade_recent는 성적표 파싱 때 이미 추출되지만
  // 어디에서도 확인되지 않고 있었음.
  if (detectNoFGradeRequirement(eligibility.other_conditions ?? "")) {
    const hasF = (profile as unknown as { has_f_grade_recent?: boolean | null }).has_f_grade_recent ?? null;
    if (hasF == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("직전학기 F학점 여부가 확인되지 않아 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "no_f_grade",
        label: "직전학기 F학점 여부",
        met: false,
        detail: "이 장학금은 직전학기 과락(F)이 없어야 해요. 정보가 없어요.",
        actionHint: "성적증명서 정보를 다시 확인해주세요.",
      });
    } else if (hasF) {
      status = "지원불가";
      unmetConditions.push("직전학기 F학점 있음");
      reasons.push("이 장학금은 직전학기 과락(F)이 없어야 하는데, F학점이 있는 것으로 확인됩니다.");
      criteria.push({
        key: "no_f_grade",
        label: "직전학기 F학점 여부",
        met: false,
        detail: "직전학기에 F학점(과락)이 있어요.",
      });
    } else {
      criteria.push({
        key: "no_f_grade",
        label: "직전학기 F학점 여부",
        met: true,
        detail: "직전학기에 F학점(과락)이 없어요.",
      });
    }
  }

  // 윤세영 스칼라십 — "부모 직장 학자금 지원 미수혜자"만 명시적으로 제외. ext-wooin과
  // 달리 교외재단/기업 수혜는 이 장학금과 무관하므로 별도로 좁혀서 확인.
  if (scholarship.id === "ext-yoon-seyoung") {
    const met = !currentScholarshipCategories.includes("부모직장학자금지원");
    if (!met) {
      status = "지원불가";
      unmetConditions.push("부모 직장 학자금 지원 수혜 중");
      reasons.push("부모 직장 학자금 지원을 받고 있으면 이 장학금은 지원할 수 없어요.");
    }
    criteria.push({
      key: "parent_employer_funding",
      label: "부모 직장 학자금 지원 여부",
      met,
      detail: met ? "부모 직장 학자금 지원을 받고 있지 않아요." : "부모 직장 학자금 지원을 받고 있어요.",
    });
  }

  // 삼송장학회 — "신입생, 타장학금 수혜자, 대학원생 제외". 신입생 제외는 다른 대부분의
  // 장학금(신입생 필수)과 반대 방향이라 별도 처리가 필요.
  if (scholarship.id === "ext-samsong") {
    if (profile.grade_level === "1") {
      status = "지원불가";
      unmetConditions.push("신입생 제외 대상");
      reasons.push("이 장학금은 신입생은 지원할 수 없어요.");
      criteria.push({ key: "freshman_exclusion", label: "신입생 여부", met: false, detail: "이 장학금은 신입생은 지원할 수 없어요." });
    }
    if (externalFundingCategories.length > 0) {
      status = "지원불가";
      unmetConditions.push("타 장학금 수혜 중 (제외 대상)");
      reasons.push("타 장학금을 받고 있으면 이 장학금은 지원할 수 없어요.");
      criteria.push({
        key: "other_scholarship_exclusion",
        label: "타 장학금 수혜 여부",
        met: false,
        detail: `현재 수혜 중: ${externalFundingCategories.join(", ")} — 타 장학금 수혜자는 제외 대상이에요.`,
      });
    }
  }

  // 벽담재단법인 — "수여식 참석 필수(불참 시 선발 취소)"는 이미 온보딩에서 묻는
  // can_attend_mandatory_events로 바로 확인 가능.
  if (scholarship.id === "ext-byeokdam") {
    const canAttend = (profile as unknown as { can_attend_mandatory_events?: string | null }).can_attend_mandatory_events ?? null;
    if (!canAttend) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("필수 행사 참석 가능 여부가 확인되지 않아 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "mandatory_event",
        label: "필수 행사 참석 가능 여부",
        met: false,
        detail: "이 장학금은 2026년 6월 수여식 참석이 필수예요. 참석 가능 여부 정보가 없어요.",
        actionHint: "온보딩에서 필수 행사 참석 가능 여부를 입력해주세요.",
      });
    } else if (canAttend === "아니오") {
      status = "지원불가";
      unmetConditions.push("필수 행사 참석 불가");
      reasons.push("이 장학금은 2026년 6월 수여식 참석이 필수인데, 참석이 어려운 것으로 확인됩니다.");
      criteria.push({
        key: "mandatory_event",
        label: "필수 행사 참석 가능 여부",
        met: false,
        detail: "이 장학금은 2026년 6월 수여식 참석이 필수예요. 불참 시 선발이 취소돼요.",
      });
    } else {
      criteria.push({
        key: "mandatory_event",
        label: "필수 행사 참석 가능 여부",
        met: true,
        detail: `필수 수여식 참석 가능 여부: ${canAttend}`,
      });
    }
  }

  // 윤송조창석 장학금 — "전년도 1,2학기 각 12학점 이상 이수". 직전학기 학점만으로는
  // 확인이 안 돼서 학기별 이수학점(semester_credits)이 필요했고, 이번에 성적표 파싱을
  // 확장해서 추가했다. 2026년 1학기 진학예정자 기준이라 "전년도"는 2025년으로 고정.
  if (scholarship.id === "ext-yoonsong-jochangseok") {
    const semesterCredits = (profile as unknown as { semester_credits?: { semester: string; credits: number }[] }).semester_credits ?? [];
    const target = ["2025-1", "2025-2"];
    const found = target.map((semester) => semesterCredits.find((entry) => entry.semester === semester) ?? null);

    if (found.every((entry) => entry == null)) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("전년도 학기별 이수학점 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "semester_credits",
        label: "전년도 학기별 이수학점",
        met: false,
        detail: "요구 조건: 2025년 1,2학기 각 12학점 이상 / 학기별 이수학점 정보 없음",
        actionHint: "성적증명서 정보를 다시 확인해주세요.",
      });
    } else {
      const met = found.every((entry) => entry != null && entry.credits >= 12);
      if (!met) {
        status = "지원불가";
        unmetConditions.push("전년도 학기별 이수학점 미달");
        reasons.push("이 장학금은 전년도 1,2학기 각 12학점 이상 이수해야 하는데, 기준에 못 미치는 학기가 있습니다.");
      }
      const detailText = target
        .map((semester, index) => `${semester}: ${found[index]?.credits ?? "정보 없음"}학점`)
        .join(", ");
      criteria.push({
        key: "semester_credits",
        label: "전년도 학기별 이수학점",
        met,
        detail: `요구 조건: 2025년 1,2학기 각 12학점 이상 / ${detailText}`,
        actionHint: met ? undefined : "이수학점이 바뀌면 다시 확인해보세요.",
      });
    }
  }

  // 삼성융합인재Track장학금 — 특정 신입생 학과, 외국인전형 입학자는 지원 불가.
  // "삼성과학인재Track 선발자는 지원 불가"는 데이터가 없어 텍스트 안내로만 남긴다.
  if (scholarship.id === "skku-samsung-convergence-track") {
    const excludedMajors = ["지능형소프트웨어학과", "반도체시스템공학과", "응용AI융합학부", "배터리학과"];
    const studentMajor = profile.major ?? "";
    if (excludedMajors.some((major) => studentMajor.includes(major))) {
      status = "지원불가";
      unmetConditions.push("제외 대상 학과 신입생");
      reasons.push("지능형소프트웨어학과·반도체시스템공학과·응용AI융합학부·배터리학과 신입생은 지원할 수 없어요.");
      criteria.push({
        key: "excluded_major",
        label: "제외 대상 학과",
        met: false,
        detail: `내 학과(${studentMajor})는 이 장학금 지원 제외 대상이에요.`,
      });
    }
    const nationality = (profile as unknown as { nationality?: string | null }).nationality ?? null;
    if (nationality === "외국인") {
      status = "지원불가";
      unmetConditions.push("외국인전형 제외 대상");
      reasons.push("외국인전형 입학자는 지원할 수 없어요.");
      criteria.push({ key: "nationality_exclusion", label: "국적(외국인전형)", met: false, detail: "외국인전형 입학자는 지원할 수 없어요." });
    }
  }

  // 우인장학재단 — cap_rule: "타 장학금(국가장학금/교내/근로장학금 제외) 수혜 학생은
  // 선발 제외". Unlike the generic "불가" case above, this scholarship names its own
  // exceptions explicitly, so it's worth a dedicated hard gate rather than staying as
  // an informational-only cap_rule note.
  if (scholarship.id === "ext-wooin") {
    if (externalFundingCategories.length > 0) {
      status = "지원불가";
      unmetConditions.push("타 장학금(국가장학금·교내·근로장학금 제외) 수혜 중");
      reasons.push("국가장학금·교내·근로장학금을 제외한 타 장학금을 받고 있으면 선발에서 제외돼요.");
      criteria.push({
        key: "other_scholarship_exclusion",
        label: "타 장학금 수혜 여부",
        met: false,
        detail: `현재 수혜 중: ${externalFundingCategories.join(", ")} — 국가장학금·교내·근로장학금 외 장학금은 제외 대상이에요.`,
        actionHint: "해당 장학금 수혜가 종료되면 다시 확인해보세요.",
      });
    } else {
      criteria.push({
        key: "other_scholarship_exclusion",
        label: "타 장학금 수혜 여부",
        met: true,
        detail: "국가장학금·교내·근로장학금 외 타 장학금 수혜 이력이 없어요.",
      });
    }
  }

  // 학생성공-복지사각지대 디딤돌장학금 — normal income_bracket_max checks assume
  // "lower bracket = more need = qualifies", but this scholarship is specifically
  // for the opposite gap case: brackets 6~10 or 미산정(unassessed), which the
  // existing single-max-threshold field can't express. Derived directly from the
  // income_bracket answer already collected in onboarding, no new question needed.
  if (scholarship.id === "skku-didimdol-welfare-gap") {
    const bracket = profile.income_bracket;
    // buildOnboardingProfile already collapses "미산정"/"모름" answers to null
    // alongside a truly-unanswered question, so this can only confidently detect
    // the numeric 6~10구간 case — the null bucket below covers both of the others
    // and safely defers to a manual check rather than guessing which one it was.
    if (bracket == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("소득구간 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "income_gap",
        label: "소득구간(복지 사각지대)",
        met: false,
        detail: "요구 조건: 소득구간 6~10구간 또는 미산정 / 내 소득구간 정보 없음",
        actionHint: "소득분위 정보를 입력해주세요.",
      });
    } else {
      const met = bracket >= 6;
      if (!met) {
        status = "지원불가";
        unmetConditions.push("소득구간 6~10구간/미산정 미해당");
        reasons.push("이 장학금은 소득구간 6~10구간이거나 소득분위가 산정되지 않은 경우만 대상입니다.");
      }
      criteria.push({
        key: "income_gap",
        label: "소득구간(복지 사각지대)",
        met,
        detail: `요구 조건: 소득구간 6~10구간 또는 미산정 / 내 소득구간 ${bracket}`,
      });
    }
  }

  // 청년창업농장학금 — "만 40세 미만(2026.1.1 기준)". 정확한 만 나이는 생월일까지
  // 필요하지만, 온보딩에는 출생연도만 받고 있어 2026년 기준 나이로 근사한다.
  if (scholarship.id === "ext-rural-youth-startup") {
    const birthYear = (profile as unknown as { birth_year?: number | null }).birth_year ?? null;
    if (birthYear == null) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("출생연도 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "age",
        label: "나이",
        met: false,
        detail: "요구 조건: 만 40세 미만(2026.1.1 기준) / 출생연도 정보 없음",
        actionHint: "온보딩에서 출생연도를 입력해주세요.",
      });
    } else {
      const approxAge = 2026 - birthYear;
      const met = approxAge < 40;
      if (!met) {
        status = "지원불가";
        unmetConditions.push("연령 조건 미충족");
        reasons.push("이 장학금은 만 40세 미만만 지원 가능한데, 나이 조건에 해당하지 않습니다.");
      }
      criteria.push({
        key: "age",
        label: "나이",
        met,
        detail: `요구 조건: 만 40세 미만(2026.1.1 기준) / 출생연도 ${birthYear}년(약 ${approxAge}세)`,
      });
    }
  }

  // 강원랜드 멘토링 장학 — region_requirement is about the student's *high school*
  // location ("석탄산업전환지역 소재 고교 출신"), not current residence, so the usual
  // "거주" parser doesn't apply. Checked directly against region_affinity.high_school_sido,
  // already collected in onboarding.
  if (scholarship.id === "ext-gangwonland-mentoring") {
    const coalRegionPattern = /정선|태백|영월|삼척|보령|문경|화순/;
    const highSchoolSido = (profile as unknown as { region_affinity?: { high_school_sido?: string | null } }).region_affinity
      ?.high_school_sido;
    if (!highSchoolSido) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push("출신고교 지역 정보가 없어 조건부 가능으로 분류했습니다.");
      criteria.push({
        key: "high_school_region",
        label: "출신고교 지역",
        met: false,
        detail: "요구 조건: 석탄산업전환지역(정선/태백/영월/삼척/보령/문경/화순) 소재 고교 출신 / 정보 없음",
        actionHint: "온보딩에서 출신고교 소재지를 입력해주세요.",
      });
    } else {
      const met = coalRegionPattern.test(highSchoolSido);
      if (!met) {
        status = "지원불가";
        unmetConditions.push("출신고교 지역 미충족");
        reasons.push("석탄산업전환지역(정선/태백/영월/삼척/보령/문경/화순) 소재 고교 출신만 지원 가능합니다.");
      }
      criteria.push({
        key: "high_school_region",
        label: "출신고교 지역",
        met,
        detail: `요구 조건: 석탄산업전환지역 소재 고교 출신 / 내 출신고교 지역: ${highSchoolSido}`,
      });
    }
  }

  // 대체 자격경로 — 동암장학회("성적우수 장학생" vs "생활 장학생")처럼 서로 다른 요건
  // 묶음 중 하나만 만족해도 되는 경우. 각 경로를 독립적으로 평가해서 하나라도 확실히
  // 통과하면 met, 통과한 경로가 없는데 판별 불가한 경로가 남아있으면 조건부가능,
  // 모든 경로가 확실히 실패했을 때만 지원불가로 떨어뜨린다.
  if (eligibility.eligibility_paths && eligibility.eligibility_paths.length > 0) {
    const profileTokens = resolveProfileSpecialStatusTokens(profile);

    const pathStates = eligibility.eligibility_paths.map((path) => {
      const parts: ("pass" | "fail" | "unknown")[] = [];
      if (path.gpa_recent_min != null) {
        parts.push(profile.gpa_recent == null ? "unknown" : profile.gpa_recent >= path.gpa_recent_min ? "pass" : "fail");
      }
      if (path.gpa_cumulative_min != null) {
        parts.push(profile.gpa_cumulative == null ? "unknown" : profile.gpa_cumulative >= path.gpa_cumulative_min ? "pass" : "fail");
      }
      if (path.special_status_any && path.special_status_any.length > 0) {
        parts.push(path.special_status_any.some((token) => profileTokens.has(token)) ? "pass" : "fail");
      }
      const state: "met" | "uncertain" | "failed" = parts.some((part) => part === "fail")
        ? "failed"
        : parts.some((part) => part === "unknown")
          ? "uncertain"
          : "met";
      return { label: path.label, state };
    });

    const metPath = pathStates.find((path) => path.state === "met");
    const uncertainPaths = pathStates.filter((path) => path.state === "uncertain");
    const pathLabels = eligibility.eligibility_paths.map((path) => path.label).join(" / ");

    if (metPath) {
      criteria.push({
        key: "eligibility_path",
        label: "자격 경로",
        met: true,
        detail: `"${metPath.label}" 경로로 조건을 충족해요. (전체 경로: ${pathLabels})`,
      });
    } else if (uncertainPaths.length > 0) {
      status = status === "지원불가" ? status : "조건부가능";
      reasons.push(`자격 경로(${pathLabels}) 중 판별에 필요한 정보가 부족해 조건부 가능으로 분류했습니다.`);
      criteria.push({
        key: "eligibility_path",
        label: "자격 경로",
        met: false,
        detail: `경로: ${pathLabels} — "${uncertainPaths.map((path) => path.label).join(", ")}" 경로는 정보 부족으로 판별이 어려워요.`,
        actionHint: "성적·특수신분 정보를 다시 확인해주세요.",
      });
    } else {
      status = "지원불가";
      unmetConditions.push("자격 경로 미충족");
      reasons.push(`자격 경로(${pathLabels}) 중 어느 것도 충족하지 못했습니다.`);
      criteria.push({
        key: "eligibility_path",
        label: "자격 경로",
        met: false,
        detail: `경로: ${pathLabels} — 어느 경로도 충족하지 못했어요.`,
      });
    }
  }

  // 자동 판별이 불가능한 조건이 남아있는 장학금 — 데이터 소스가 아예 없어서 다른
  // 조건은 모두 통과해도 이 부분만큼은 확인해줄 수 없는 경우. 텍스트로만 두면 다른
  // 조건이 다 통과했을 때 "지원가능"으로 잘못 뜰 수 있어서, 명시적으로 조건부가능
  // 상한을 씌운다.
  const manualVerificationNote = MANUAL_VERIFICATION_REQUIRED[scholarship.id];
  if (manualVerificationNote) {
    if (status === "지원가능") {
      status = "조건부가능";
    }
    reasons.push(manualVerificationNote);
    criteria.push({
      key: "manual_verification",
      label: "직접 확인 필요",
      met: false,
      detail: manualVerificationNote,
      actionHint: "공식 공고를 통해 직접 확인해주세요.",
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
// Maps scholarship id -> the onboarding conditional-question(s) that gate it.
// questionId matches the id used by the corresponding CONDITIONAL_TRIGGERS entry
// in src/types/onboarding.ts (WIRED_TRIGGER_IDS marks which ones are asked).
// Each entry was checked against the scholarship's actual eligibility text before
// being added here — see the audit notes in that file for what was excluded and why.
const CONDITIONAL_GATES: Record<
  string,
  { questionId: string; requireTrue: boolean; label: string; requirementText: string }[]
> = {
  "ext-seoulfuture-exchange": [
    { questionId: "exchange-plan", requireTrue: true, label: "교환학생 파견 예정", requirementText: "당해년도 2학기 교환학생 파견(예정)자만 지원 가능해요." },
  ],
  "ext-miraeasset": [
    { questionId: "exchange-plan", requireTrue: true, label: "교환학생 파견 예정", requirementText: "모교 교환학생 파견을 재학 중 최초 획득(예정)해야 해요." },
  ],
  "skku-jobyeongdu": [
    { questionId: "exchange-plan", requireTrue: false, label: "교환학생 파견 예정 아님", requirementText: "교환학생 파견(해외체류) 예정자는 신청할 수 없어요." },
  ],
  "ext-ilchon": [
    { questionId: "stem-track", requireTrue: true, label: "이공계 전공", requirementText: "자연/공학 계열 전공만 지원 가능해요." },
  ],
  "ext-surim": [
    { questionId: "stem-track", requireTrue: true, label: "이공계 전공", requirementText: "이공계열(재단 지정 학과)만 지원 가능해요." },
  ],
  "ext-samsong": [
    { questionId: "stem-track", requireTrue: true, label: "이공계 전공", requirementText: "전기·전자·기계·신소재공학 등 공학계열만 지원 가능해요." },
  ],
  "ext-suwon-gwahak": [
    { questionId: "stem-track", requireTrue: true, label: "이공계 전공", requirementText: "이공계 재학생만 지원 가능해요." },
  ],
  "ext-hyundai-cmk": [
    { questionId: "stem-track", requireTrue: true, label: "이공계 전공", requirementText: "이공계 전 분야 재학생만 지원 가능해요." },
  ],
  "ext-bogeon-research": [
    { questionId: "research-plan", requireTrue: true, label: "연구계획", requirementText: "연구 지도교수와 함께하는 연구계획이 필요해요." },
  ],
  "skku-medical-ai-research": [
    {
      questionId: "medical-ai-track-complete",
      requireTrue: true,
      label: "의료AI 마이크로디그리·논문·사업참여 조건",
      requirementText: "의료AI 마이크로디그리(Track A/B) 이수 중, 의료AI 관련 KCI급 이상 논문 출판, 사업 참여 누적 1년 이상을 모두 충족해야 해요.",
    },
  ],
  "skku-ai-microdegree": [
    {
      questionId: "ai-microdegree-complete",
      requireTrue: true,
      label: "AI 마이크로디그리 이수",
      requirementText: "2026년 1학기에 9개 AI 마이크로디그리 과정 중 하나를 이수하고, 4과목 평균 B+ 이상이어야 해요.",
    },
  ],
  "ext-wooin": [
    {
      questionId: "wooin-eligibility",
      requireTrue: true,
      label: "지원 자격(저소득/성적우수/봉사/예체능)",
      requirementText: "저소득 가정, 성적우수, 봉사정신, 예체능 재능 중 1개 이상 해당해야 해요.",
    },
  ],
  "skku-campus-life-didimdol": [
    { questionId: "freshman", requireTrue: true, label: "신입생 여부", requirementText: "학부 신입생만 지원 가능해요." },
  ],
  "ext-yoon-seyoung": [
    { questionId: "freshman", requireTrue: true, label: "신입생 여부", requirementText: "2026년도 신입생만 지원 가능해요." },
  ],
  "skku-samsung-convergence-track": [
    { questionId: "freshman", requireTrue: true, label: "신입생 여부", requirementText: "2026학년도 학부 신입생 및 2025년 후기 입학생만 지원 가능해요." },
  ],
  "skku-gongro-gosi": [
    {
      questionId: "exam-path",
      requireTrue: true,
      label: "고시/전문자격 합격 이력",
      requirementText: "행정/기술/입법고등고시·외교관후보자시험 1차 합격 또는 공인회계사·변리사 최종 합격자만 지원 가능해요.",
    },
  ],
  "skku-seonggyun-family": [
    {
      questionId: "family-alumni",
      requireTrue: true,
      label: "가족 성균관대 동문/재학 여부",
      requirementText: "형제자매/직계3대/직계2대/부부/부모 중 성균관대학교 동문 또는 재학생이 있어야 해요.",
    },
  ],
};

// 희망 진로 체크박스(중복선택) 기반 게이트 — 온보딩에서 선택한 진로 자체가 명확한
// 답이라 exam-qualification과 달리 별도 확인 질문 없이 바로 게이트한다. 체크박스를
// 안 고른 건 특수신분 칩과 같은 관례로 "해당없음"이라는 확정 답으로 취급한다.
const CAREER_INTEREST_GATES: Record<string, { interest: string; requirementText: string }> = {
  "ext-pureundae-doonamu": { interest: "IT/블록체인", requirementText: "IT/블록체인 관련 진로 희망자만 지원 가능해요." },
  "ext-lotte-sinkyeokho": { interest: "언론/미디어", requirementText: "언론·미디어(PD/기자/아나운서/기획마케팅) 취업 희망자만 지원 가능해요." },
  "ext-rural-youth-startup": {
    interest: "농업/창업",
    requirementText: "졸업 후 영농/농림축산식품 분야 의무 종사가 가능한 창업 희망자만 지원 가능해요.",
  },
};

// Conditions with no realistic onboarding data source at all (household-level
// uniqueness, past-award history, degree records, department-level graduation
// credit totals) — rather than silently letting these ride along as pure
// informational text while status reads 지원가능, cap the status so the student
// knows to verify manually.
const MANUAL_VERIFICATION_REQUIRED: Record<string, string> = {
  "ext-inmun-100nyeon": "이수학점이 졸업요건의 40% 이상인지는 학과별 졸업 필요 학점 정보가 없어 자동 판별이 어려워요.",
  "ext-hyundai-cmk": "전문대 재학 여부는 자동 판별이 어려워요. 4년제 대학 재학생만 지원 가능해요.",
  "ext-surim": "대학 1학년 때 24학점 이상 이수했는지는 학년별 이수학점 정보가 없어 자동 판별이 어려워요.",
  "ext-songpa-injae": "가구(세대)당 1명 선발 원칙과 직전 학기 수혜 이력은 자동 판별이 어려워요.",
  "ext-lotte-sinkyeokho": "1~7기 기수혜 이력은 자동 판별이 어려워요.",
  "ext-bogeon-research": "박사학위 취득 여부와 과거 수혜 이력은 자동 판별이 어려워요.",
};

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
// Finds every "제외"/"불가" occurrence and looks backward in a short window for
// enrollment-status keywords, so list-style phrasing ("휴학·교환·초과학기·졸업유예
// 제외") catches every item in the list, not just the one immediately before the
// marker. Returns next_semester_status literal values so callers can compare directly.
function detectEnrollmentExclusions(text: string): Set<string> {
  const excluded = new Set<string>();
  for (const match of text.matchAll(/제외|불가/g)) {
    const window = text.slice(Math.max(0, match.index - 30), match.index);
    if (/휴학/.test(window)) excluded.add("휴학");
    if (/교환/.test(window)) excluded.add("교환학생파견");
    if (/초과학기/.test(window)) excluded.add("초과학기");
    if (/마지막학기|최종학기|졸업유예/.test(window)) excluded.add("졸업예정");
  }
  return excluded;
}

// "대한민국 국적자" (positive requirement) or "외국인 ... 제외/불가" (explicit
// exclusion) — both boil down to the same gate: 외국인 nationality doesn't qualify,
// 내국인/재외국민 do.
function detectForeignExclusion(text: string): boolean {
  if (/대한민국\s*국적자/.test(text)) return true;
  for (const match of text.matchAll(/제외|불가/g)) {
    const window = text.slice(Math.max(0, match.index - 20), match.index);
    if (/외국인/.test(window)) return true;
  }
  return false;
}

// "직전학기 과락(F) 없어야 함" 류의 조건 — has_f_grade_recent는 성적표 파싱 때 이미
// 추출되지만 어디에서도 확인되지 않고 있었음.
function detectNoFGradeRequirement(text: string): boolean {
  return /(?:과락|F\s*학점|낙제)[^.]{0,10}(?:없어야|불가|제외)/.test(text);
}

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
