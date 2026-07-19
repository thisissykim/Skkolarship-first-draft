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
  credits_recent: number | null;
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
  | "건강보험료"
  | "재산세"
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
  extends Omit<BaseStudentProfile, "region" | "currentScholarships">,
    Partial<ParsedTranscript>,
    Partial<CommonAnswers> {
  special_status: SpecialStatus[];
  region_affinity?: RegionAffinity;
  current_scholarships?: CommonAnswers["current_scholarships"];
  wish_career?: string | null;
  research_plan?: string | null;
  school_name?: string | null;
  region?: RegionAffinity;
  next_semester_status?: CommonAnswers["next_semester_status"];
  remaining_regular_semesters?: number;
  low_income_type?: CommonAnswers["low_income_type"];
  nationality?: CommonAnswers["nationality"];
  foreign_visa_type?: string;
  can_attend_mandatory_events?: CommonAnswers["can_attend_mandatory_events"];
  income_bracket?: CommonAnswers["income_bracket"];
  major?: string | null;
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
    trigger_id: "it-blockchain",
    condition: (profile) => Boolean(profile.wish_career && /it|정보|소프트웨어|개발/i.test(profile.wish_career)),
    questions: [{ id: "it-career", label: "희망 진로가 IT인가요?", type: "boolean" }],
    related_scholarship_ids: ["ext-pureundae-doonamu"],
  },
  {
    trigger_id: "media-journalism",
    condition: (profile) => Boolean(profile.wish_career && /언론|미디어|신문|방송|저널/i.test(profile.wish_career)),
    questions: [{ id: "media-career", label: "희망 진로가 언론/미디어인가요?", type: "boolean" }],
    related_scholarship_ids: ["ext-lotte-sinkyeokho"],
  },
  {
    trigger_id: "agri-startup",
    condition: (profile) => Boolean(profile.wish_career && /농업|창업/i.test(profile.wish_career)),
    questions: [{ id: "agri-career", label: "희망 진로가 농업/창업인가요?", type: "boolean" }],
    related_scholarship_ids: ["ext-rural-youth-startup"],
  },
  {
    trigger_id: "exam-qualification",
    condition: (profile) => Boolean(profile.wish_career && /고시|전문자격|회계사|변리사|행시|입법고시|외교관/i.test(profile.wish_career)),
    questions: [{ id: "exam-path", label: "고시/전문자격 수험 준비 중인가요?", type: "boolean" }],
    related_scholarship_ids: ["skku-gongro-gosi"],
  },
  {
    trigger_id: "research-plan",
    condition: (profile) => Boolean(profile.research_plan) || /보건|사회복지/.test((profile.department ?? profile.major ?? "").toLowerCase()),
    questions: [{ id: "research-plan", label: "연구계획이 있나요?", type: "boolean" }],
    related_scholarship_ids: ["ext-bogeon-research", "skku-medical-ai-research"],
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
