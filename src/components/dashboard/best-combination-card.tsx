"use client";

import { useState } from "react";
import Link from "next/link";
import type { CombinationResult } from "@/engine/bestCombination";

function formatKrw(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export default function BestCombinationCard({
  combination,
  userName,
}: {
  combination: CombinationResult;
  userName: string | null;
}) {
  const [showConflicts, setShowConflicts] = useState(false);
  const { totalAmount, combination: items, excludedDueToConflict } = combination;

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 rounded-[2rem] border border-pine-200 bg-gradient-to-br from-pine-50 to-white p-6 shadow-sm">
      <p className="text-xs font-bold tracking-[0.2em] text-pine-600">중복 수혜 시뮬레이션</p>
      <h2 className="mt-1 text-2xl font-extrabold text-navy-900">최대 수령 가능 조합</h2>
      <p className="mt-2 text-sm text-navy-500">
        서로 중복 수혜가 가능한 지원가능(확정) 장학금들을 조합했을 때 예상되는 최대 수령액이에요. 등록금성 장학금은 등록금
        한도 내에서, 생활비성 장학금은 조건이 맞으면 모두 함께 계산돼요.
      </p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-pine-100 bg-white">
        <ul className="divide-y divide-dashed divide-pine-100">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/scholarships/${item.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-pine-50/60"
              >
                <span className="text-sm font-medium text-navy-800">{item.name}</span>
                <span className="shrink-0 font-mono text-sm font-semibold text-pine-700">
                  {item.amount_max_krw ? `+${formatKrw(item.amount_max_krw)}` : "금액 미확정"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t-2 border-navy-900 bg-navy-950 px-5 py-4">
          <span className="text-sm font-semibold text-white">합계</span>
          <span className="font-mono text-lg font-bold text-cyan-300">{formatKrw(totalAmount)}</span>
        </div>
      </div>

      <p className="mt-5 rounded-2xl bg-navy-950 px-5 py-4 text-center text-base font-bold text-white">
        {userName ? `${userName}님의` : "회원님의"} 최대수령가능 장학금은{" "}
        <span className="text-cyan-300">{formatKrw(totalAmount)}</span>입니다!
      </p>

      {excludedDueToConflict.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowConflicts((value) => !value)}
            className="text-sm font-medium text-navy-500 underline underline-offset-4 transition hover:text-navy-800"
          >
            {showConflicts ? "중복불가로 제외된 장학금 숨기기" : `중복불가로 제외된 장학금 ${excludedDueToConflict.length}개 보기`}
          </button>
          {showConflicts ? (
            <ul className="mt-3 space-y-1.5 text-sm text-navy-500">
              {excludedDueToConflict.map(({ scholarship, conflictWith }) => (
                <li key={scholarship.id} className="rounded-xl bg-white/60 px-3 py-2">
                  <span className="font-medium text-navy-700">{scholarship.name}</span> — {conflictWith}과(와) 동시 수혜 불가
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
