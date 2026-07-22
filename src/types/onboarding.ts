import type { StudentProfile as BaseStudentProfile } from "@/types/scholarship";

export interface ParsedTranscript {
  university: string | null;
  college: string | null;
  department: string | null;
  grade_level: "1" | "2" | "3" | "4" | null;
  semester_progress: string | null;
  gpa_cumulative: number | null;
  gpa_cumulative_scale: 4.5 | 4.3 | null;
  percentile_cumulative: number | null;
  gpa_recent: number | null;
  percentile_recent: number | null;
  credits_recent: number | null;
  semester_credits: { semester: string; credits: number }[];
  has_f_grade_recent: boolean | null;
  credits_total: number | null;
  course_history: string[];
  exchange_semester_detected: boolean | null;
  parsed_at: string;
  needs_confirmation: boolean;
}

export interface CommonAnswers {
  nationality: "내국인" | "재외국민" | "외국인";
  foreign_visa_type?: string;
  birth_year: number | null;
  next_semester_status: "재학" | "복학" | "휴학" | "졸업예정" | "초과학기" | "교환학생파견";
  remaining_regular_semesters: number;
  income_bracket: number | "미산정" | "모름";
  low_income_type: "기초생활수급" | "차상위" | "한부모" | "해당없음";
  region: { sido: string; sigungu: string; years_resided: number };
  current_scholarships: Array<"없음" | "국가장학금" | "교내" | "교외재단/기업" | "부모직장학자금지원">;
  can_attend_mandatory_events: "예" | "아니오" | "조건부가능";
}

export type SpecialStatus =
  | "해당없음"
  | "장애인"
  | "중증장애인"
  | "기초생활수급자"
  | "차상위계층"
  | "한부모"
  | "탈북민"
  | "다문화"
  | "이주배경"
  | "자립준비청년"
  | "가족돌봄"
  | "국가유공자"
  | "독립유공자후손"
  | "보훈대상자"
  | "다자녀"
  | "LH임대주택거주"
  | "기타";

export interface RegionAffinity {
  high_school_sido?: string;
  birth_place?: string;
  parent_origin_or_residence?: string;
}

export interface StudentProfileFull
  extends Omit<
      BaseStudentProfile,
      | "region"
      | "currentScholarships"
      | "income_bracket"
      | "credits_recent"
      | "gpa_recent"
      | "gpa_cumulative"
      | "grade_level"
      | "major"
    >,
    Partial<ParsedTranscript>,
    Partial<CommonAnswers> {
  special_status: SpecialStatus[];
  region_affinity?: RegionAffinity;
  current_scholarships?: CommonAnswers["current_scholarships"];
  wish_career?: string | null;
  career_interests?: string[];
  research_plan?: string | null;
  school_name?: string | null;
  next_semester_status?: CommonAnswers["next_semester_status"];
  remaining_regular_semesters?: number;
  low_income_type?: CommonAnswers["low_income_type"];
  nationality?: CommonAnswers["nationality"];
  foreign_visa_type?: string;
  can_attend_mandatory_events?: CommonAnswers["can_attend_mandatory_events"];
  income_bracket?: CommonAnswers["income_bracket"];
  major?: string | null;
  conditional_answers?: Record<string, boolean>;
}

export type ConditionalQuestion = {
  id: string;
  label: string;
  type: "boolean" | "select" | "text";
  options?: string[];
  helperText?: string;
  skippable?: boolean;
};

export interface ConditionalTrigger {
  trigger_id: string;
  condition: (profile: StudentProfileFull) => boolean;
  questions: ConditionalQuestion[];
  related_scholarship_ids: string[];
}

export const CONDITIONAL_TRIGGERS: ConditionalTrigger[] = [
  {
    trigger_id: "exchange-plan",
    condition: (profile) => profile.next_semester_status === "교환학생파견" || Boolean(profile.exchange_semester_detected),
    questions: [
      {
        id: "exchange-plan",
        label: "다음 학기에 교환학생 파견 예정인가요?",
        type: "boolean",
        skippable: true,
      },
    ],
    related_scholarship_ids: ["ext-seoulfuture-exchange", "ext-miraeasset"],
  },
  {
    trigger_id: "stem-engineering",
    condition: (profile) => {
      const major = (profile.department ?? profile.major ?? "").toLowerCase();
      const isStem =
        /공학|전자|전기|컴퓨터|소프트웨어|기계|산업|화학|생명|바이오|자연/.test(major);
      return isStem && ["2", "3"].includes(profile.grade_level ?? "");
    },
    questions: [
      {
        id: "stem-track",
        label: "전공계열이 자연/공학 계열인가요?",
        type: "boolean",
      },
      {
        id: "stem-grade",
        label: "현재 학년은?",
        type: "select",
        options: ["2학년", "3학년"],
      },
    ],
    related_scholarship_ids: ["ext-ilchon", "ext-surim", "ext-samsong", "ext-suwon-gwahak"],
  },
  {
    trigger_id: "chem-bio",
    condition: (profile) => {
      const major = (profile.department ?? profile.major ?? "").toLowerCase();
      const isChemBio = /화학|바이오|생명|생물/.test(major);
      return isChemBio && ["3", "4"].includes(profile.grade_level ?? "");
    },
    questions: [
      {
        id: "chem-bio-major",
        label: "전공이 화학/바이오 계열인가요?",
        type: "boolean",
      },
      {
        id: "chem-bio-grade",
        label: "현재 학년은?",
        type: "select",
        options: ["3학년", "4학년"],
      },
    ],
    related_scholarship_ids: ["ext-songhwa"],
  },
  {
    trigger_id: "hyundai-cmk",
    condition: (profile) => {
      const major = (profile.department ?? profile.major ?? "").toLowerCase();
      const isEngineering = /공학|전자|전기|컴퓨터|소프트웨어|기계|산업|화학|생명|바이오|자연/.test(major);
      return isEngineering && ["2", "3"].includes(profile.grade_level ?? "");
    },
    questions: [
      { id: "hyundai-cmk", label: "이공계 전공인가요?", type: "boolean" },
      { id: "hyundai-cmk-grade", label: "현재 학년은?", type: "select", options: ["2학년", "3학년"] },
    ],
    related_scholarship_ids: ["ext-hyundai-cmk"],
  },
  {
    trigger_id: "exam-qualification",
    // IT/블록체인, 언론/미디어, 농업/창업 진로는 온보딩의 희망 진로 체크박스 선택 자체가
    // 이미 명확한 답이라 별도 확인 질문 없이 career_interests로 바로 게이트한다
    // (matchScholarship.ts의 CAREER_INTEREST_GATES 참고). 고시/전문자격만 "관심"과
    // "이미 합격"이 다른 사실이라 체크 이후 한 번 더 확인 질문이 필요하다.
    condition: (profile) => Boolean(profile.career_interests?.includes("고시/전문자격")),
    questions: [
      {
        id: "exam-path",
        label: "행정/기술/입법고등고시·외교관후보자시험 1차 합격 또는 공인회계사·변리사 최종 합격 이력이 있나요?",
        type: "boolean",
        helperText: "공로(고시)장학금은 준비 중이 아니라 이미 합격한 경우에만 지원할 수 있어요.",
      },
    ],
    related_scholarship_ids: ["skku-gongro-gosi"],
  },
  {
    trigger_id: "skku-family-alumni",
    condition: (profile) => profile.grade_level === "1" || profile.semester_progress?.startsWith("1-") === true,
    questions: [
      {
        id: "family-alumni",
        label: "가족(형제자매/부모/조부모 등) 중 성균관대학교 졸업생 또는 재학생이 있나요?",
        type: "boolean",
      },
    ],
    related_scholarship_ids: ["skku-seonggyun-family"],
  },
  {
    trigger_id: "research-plan",
    condition: (profile) => Boolean(profile.research_plan) || /보건|사회복지/.test((profile.department ?? profile.major ?? "").toLowerCase()),
    questions: [{ id: "research-plan", label: "연구계획이 있나요?", type: "boolean" }],
    related_scholarship_ids: ["ext-bogeon-research"],
  },
  {
    trigger_id: "medical-ai-track",
    condition: () => true,
    questions: [
      {
        id: "medical-ai-track-complete",
        label:
          "의료AI 마이크로디그리(Track A/B) 또는 관련 대학원 과정을 이수 중이고, 의료AI 관련 KCI급 이상 논문 출판(1저자/차석/교신) 및 사업 참여 누적 1년 이상 조건을 모두 충족하나요?",
        type: "boolean",
      },
    ],
    related_scholarship_ids: ["skku-medical-ai-research"],
  },
  {
    trigger_id: "ai-microdegree-complete",
    condition: () => true,
    questions: [
      {
        id: "ai-microdegree-complete",
        label: "2026년 1학기에 9개 AI 마이크로디그리 과정 중 하나를 이수했고, 이수 4과목 평균이 B+ 이상인가요?",
        type: "boolean",
      },
    ],
    related_scholarship_ids: ["skku-ai-microdegree"],
  },
  {
    trigger_id: "wooin-self-declare",
    condition: () => true,
    questions: [
      {
        id: "wooin-eligibility",
        label: "저소득 가정, 성적우수, 봉사정신, 예체능 재능 중 하나 이상 해당하나요?",
        type: "boolean",
      },
    ],
    related_scholarship_ids: ["ext-wooin"],
  },
  {
    trigger_id: "freshman",
    condition: (profile) => profile.grade_level === "1" || profile.semester_progress?.startsWith("1-") === true,
    questions: [{ id: "freshman", label: "신입생인가요?", type: "boolean" }],
    related_scholarship_ids: [
      "ext-seoulfuture-cheongchun",
      "ext-yoon-seyoung",
      "skku-campus-life-didimdol",
      "skku-samsung-convergence-track",
    ],
  },
  {
    trigger_id: "skku-affiliation",
    condition: (profile) => Boolean(profile.school_name && /성균관대학교/.test(profile.school_name)),
    questions: [{ id: "skku-affiliation", label: "성균관대 재학생인가요?", type: "boolean" }],
    related_scholarship_ids: ["skku-ai-microdegree", "skku-medical-ai-research", "skku-seonggyun-family"],
  },
  {
    trigger_id: "upper-grade-remaining",
    condition: (profile) => ["3", "4"].includes(profile.grade_level ?? "") && (profile.remaining_regular_semesters ?? 0) >= 2,
    questions: [
      { id: "upper-grade", label: "3~4학년이고 잔여 2학기 이상인가요?", type: "boolean" },
    ],
    related_scholarship_ids: ["skku-jobyeongdu"],
  },
  {
    trigger_id: "income-bracket-gap",
    condition: (profile) =>
      profile.income_bracket === "미산정" ||
      (typeof profile.income_bracket === "number" && profile.income_bracket >= 6 && profile.income_bracket <= 10),
    questions: [
      { id: "income-bracket-gap", label: "지원구간이 6~10구간이거나 미산정인가요?", type: "boolean" },
    ],
    related_scholarship_ids: ["skku-didimdol-welfare-gap", "ext-dongam"],
  },
  {
    trigger_id: "songpa-residence",
    condition: (profile) => profile.region_affinity?.birth_place?.includes("송파") ?? false,
    questions: [{ id: "songpa-residence", label: "거주지가 송파구인가요?", type: "boolean" }],
    related_scholarship_ids: ["ext-songpa-injae"],
  },
  {
    trigger_id: "coal-region-highschool",
    condition: (profile) => /석탄산업전환지역/.test(profile.region_affinity?.high_school_sido ?? ""),
    questions: [{ id: "coal-region-highschool", label: "출신고교가 석탄산업전환지역인가요?", type: "boolean" }],
    related_scholarship_ids: ["ext-gangwonland-mentoring"],
  },
  {
    trigger_id: "religious-club",
    condition: (profile) => (profile.activities ?? []).some((activity) => /종교|동아리/.test(activity)),
    questions: [
      {
        id: "religious-club",
        label: "종교 관련 동아리/활동이 있나요?",
        type: "boolean",
        skippable: true,
        helperText: "왜 물어보나요? 일부 장학금의 재단 가치와 활동 적합성을 확인하기 위해서예요.",
      },
    ],
    related_scholarship_ids: ["ext-cheongho-buddhist"],
  },
  {
    trigger_id: "award-leadership",
    condition: (profile) => (profile.activities ?? []).some((activity) => /리더십|표창|회장|간사|부회장/.test(activity)),
    questions: [{ id: "award-leadership", label: "리더십/표창 관련 활동이 있나요?", type: "boolean" }],
    related_scholarship_ids: ["ext-korea-leader-foundation", "ext-wooin", "ext-ktng-sangsang"],
  },
  {
    trigger_id: "recommendation-letter",
    condition: (profile) => Boolean(profile.can_attend_mandatory_events),
    questions: [{ id: "recommendation-letter", label: "추천서 요청이 가능한가요?", type: "boolean", skippable: true }],
    related_scholarship_ids: [
      "skku-jeongyongji-changui",
      "ext-ilchon",
      "ext-ugang",
      "ext-songhwa",
      "ext-yoonsong-jochangseok",
      "ext-samsong",
      "ext-dongam",
      "ext-surim",
    ],
  },
];

// CONDITIONAL_TRIGGERS was fully designed but never wired into the onboarding UI or
// the matching engine. Cross-checking each trigger's related scholarships against
// their actual eligibility text found several mismatches (e.g. "고시 준비 중"
// doesn't match "이미 합격한 사람", "불교학생회 소속" is a stated preference not a
// requirement, "추천서 요청 가능" is a document-logistics question, not eligibility).
// Only these trigger_ids correspond to a real, unambiguous pass/fail requirement —
// those are the ones actually asked and used to gate matching. The rest stay defined
// above (useful reference / future candidates) but are intentionally not surfaced.
export const WIRED_TRIGGER_IDS = [
  "exchange-plan",
  "stem-engineering",
  "hyundai-cmk",
  "research-plan",
  "freshman",
  "exam-qualification",
  "skku-family-alumni",
  "medical-ai-track",
  "ai-microdegree-complete",
  "wooin-self-declare",
];
