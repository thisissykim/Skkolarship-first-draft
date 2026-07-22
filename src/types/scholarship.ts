export type ScholarshipSource = "교내" | "교외";

export type ScholarshipSourceDetail =
  | "교내"
  | "국가"
  | "지자체"
  | "민간재단"
  | "민간(교내연계)";

export type ScholarshipType =
  | "등록금성"
  | "생활비성"
  | "등록금성+생활비성"
  | "연구지원"
  | "선택(등록금/생활비)"
  | "혼합/선택";

export type ApplyChannel = "GLS" | "재단홈페이지" | "이메일" | "우편/방문" | "기타";

export type DuplicateAllowance = "가능" | "불가" | "조건부" | "미확인";

export interface ScholarshipEligibility {
  grade_level: string | null;
  college_requirement: string | null;
  gpa_recent_min: number | null;
  gpa_cumulative_min: number | null;
  gpa_scale: 4.5 | 4.3 | 100;
  // OR-alternative to gpa_cumulative_min on a different scale (e.g. "백분위 90점
  // 또는 평점 3.6/4.5 이상") — met if EITHER threshold is satisfied. Null when a
  // scholarship only has one GPA path.
  gpa_cumulative_min_alt: number | null;
  gpa_scale_alt: 4.5 | 4.3 | 100 | null;
  // Restricts gpa_cumulative_min(_alt) to specific grade_level digits (e.g. ["3"]
  // when only 3학년 has a GPA bar and 1학년 is exempt). Null means the GPA condition
  // applies to every grade matched by grade_level, same as before this field existed.
  gpa_condition_grades: string[] | null;
  credits_recent_min: number | null;
  credits_recent_min_last_semester: number | null;
  income_bracket_max: number | null;
  special_status: string[];
  major_requirement: string | null;
  region_requirement: string | null;
  // Alternative ways to qualify beyond the flat gpa_recent_min/gpa_cumulative_min
  // fields above (e.g. 동암장학회's "성적우수 장학생" vs "생활 장학생", entirely
  // different requirement bundles rather than the same bar on a different scale).
  // Met if the flat fields pass OR any one path passes; null/empty means no
  // alternative paths exist, same as before this field existed.
  eligibility_paths: EligibilityPath[] | null;
  other_conditions: string | null;
}

export interface EligibilityPath {
  label: string;
  gpa_recent_min?: number | null;
  gpa_cumulative_min?: number | null;
  gpa_scale?: 4.5 | 4.3 | 100;
  // Met if the student's special_status/derived categories include ANY one of these
  // (same canonical tokens as the main special_status matching).
  special_status_any?: string[];
}

export interface DuplicateConflictRule {
  allows_other_scholarships: DuplicateAllowance;
  cap_rule: string | null;
}

export interface Scholarship {
  id: string;
  name: string;
  source: ScholarshipSource;
  source_detail: ScholarshipSourceDetail;
  type: ScholarshipType;
  amount_text: string | null;
  amount_max_krw: number | null;
  recommended_slots: number | null;
  apply_start: string | null;
  apply_end: string | null;
  apply_period_note: string | null;
  eligibility: ScholarshipEligibility;
  duplicate_conflict: DuplicateConflictRule;
  required_docs: string[];
  official_url: string | null;
  apply_channel: ApplyChannel;
  risk_flags: string[];
  needs_review: boolean;
  notes: string | null;
}

export interface ScholarshipDataset {
  schema_version: string;
  generated_at: string;
  source_note: string;
  count: number;
  field_guide: Record<string, string>;
  scholarships: Scholarship[];
}

export type EligibilityStatus = "지원가능" | "조건부가능" | "지원불가";

export interface EligibilityResult {
  scholarship_id: string;
  status: EligibilityStatus;
  reason_text: string;
  unmet_conditions?: string[];
}

export interface StudentProfile {
  user_id: string;
  gpa_recent: number | null;
  gpa_cumulative: number | null;
  credits_recent: number | null;
  grade_level: string | null;
  income_bracket: number | null;
  special_status: string[];
  major: string | null;
  region: string | null;
  updated_at: string;
  nationalScholarshipApplied?: boolean | null;
  currentScholarships?: Array<{
    name: string;
    amount: number;
    type: ScholarshipType;
    provider?: string | null;
  }>;
  activities?: string[];
  enrollmentStatus?: string | null;
}

