import type { Scholarship, StudentProfile } from "@/types/scholarship";
import { matchScholarship } from "@/engine/matchScholarship";

const TUITION_CAP = 4_000_000;

export type CombinationResult = {
  totalAmount: number;
  combination: Scholarship[];
  excludedDueToConflict: { scholarship: Scholarship; conflictWith: string }[];
};

export function bestCombination(profile: StudentProfile, scholarships: Scholarship[]): CombinationResult {
  // Only count confirmed-eligible scholarships — 조건부가능 (needs manual
  // verification, e.g. missing income/GPA data) isn't guaranteed money and
  // shouldn't inflate a headline "최대 수령 가능 N원" total.
  const matched = scholarships
    .map((scholarship) => ({ scholarship, match: matchScholarship(profile, scholarship) }))
    .filter(({ match }) => match.status === "지원가능");

  const living = matched
    .filter(({ scholarship }) => scholarship.type !== "등록금성")
    .map(({ scholarship }) => scholarship);

  const tuitionCandidates = matched
    .filter(({ scholarship }) => scholarship.type === "등록금성")
    .map(({ scholarship }) => scholarship);

  const { combination: tuitionCombination, totalAmount: tuitionTotal, conflicts } = chooseBestTuition(
    profile,
    tuitionCandidates,
  );

  const combination = [...tuitionCombination, ...living];
  const totalAmount =
    tuitionTotal + living.reduce((sum, scholarship) => sum + (scholarship.amount_max_krw ?? scholarship.amount_max_krw ?? 0), 0);

  return {
    totalAmount,
    combination,
    excludedDueToConflict: conflicts,
  };
}

function chooseBestTuition(profile: StudentProfile, candidates: Scholarship[]) {
  let best: Scholarship[] = [];
  let bestAmount = 0;
  let conflicts: { scholarship: Scholarship; conflictWith: string }[] = [];

  function backtrack(index: number, selected: Scholarship[], currentAmount: number) {
    if (currentAmount > TUITION_CAP) return;
    if (currentAmount > bestAmount) {
      best = [...selected];
      bestAmount = currentAmount;
      conflicts = collectConflicts(candidates, selected);
    }
    if (index >= candidates.length) return;

    for (let i = index; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (selected.some((item) => conflictsWith(item, candidate))) continue;
      selected.push(candidate);
      backtrack(i + 1, selected, currentAmount + (candidate.amount_max_krw ?? 0));
      selected.pop();
    }
  }

  backtrack(0, [], 0);

  return { combination: best, totalAmount: bestAmount, conflicts };
}

function conflictsWith(a: Scholarship, b: Scholarship) {
  if (a.duplicate_conflict.allows_other_scholarships === "불가" || b.duplicate_conflict.allows_other_scholarships === "불가") {
    return a.source_detail !== "국가" && b.source_detail !== "국가" && a.source_detail !== b.source_detail;
  }
  return false;
}

function collectConflicts(all: Scholarship[], selected: Scholarship[]) {
  const selectedIds = new Set(selected.map((item) => item.id));
  return all
    .filter((scholarship) => !selectedIds.has(scholarship.id))
    .map((scholarship) => ({
      scholarship,
      conflictWith: selected.find((item) => conflictsWith(item, scholarship))?.name ?? "충돌 규칙",
    }))
    .filter((item) => item.conflictWith !== "충돌 규칙");
}

