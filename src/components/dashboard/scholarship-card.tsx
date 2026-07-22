"use client";

import { useState } from "react";
import Link from "next/link";
import type { Scholarship } from "@/lib/scholarships";
import { SCHOLARSHIP_STATUS_LABELS } from "@/lib/scholarships";
import { useFavoritesStore } from "@/store/useFavoritesStore";

export default function ScholarshipCard({
  scholarship,
}: {
  scholarship: Scholarship;
}) {
  const favorites = useFavoritesStore((state) => state.favorites);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const isFavorite = favorites.includes(scholarship.id);
  const [justPopped, setJustPopped] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [risksOpen, setRisksOpen] = useState(false);

  const criteria = scholarship.matchCriteria ?? [];
  const metCount = criteria.filter((c) => c.met).length;
  const unmetCount = criteria.length - metCount;

  function handleToggleFavorite() {
    toggleFavorite(scholarship.id);
    setJustPopped(true);
  }

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
              {SCHOLARSHIP_STATUS_LABELS[scholarship.status]}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {scholarship.type === "TUITION" ? "등록금성" : "생활비성"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {scholarship.source === "CAMPUS" ? "교내" : "교외"}
            </span>
          </div>
          <h2 className="mt-4 text-xl font-semibold">{scholarship.name}</h2>
          <p className="mt-2 text-sm text-slate-600">{scholarship.amount}</p>
        </div>

        <button
          type="button"
          onClick={handleToggleFavorite}
          onAnimationEnd={() => setJustPopped(false)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 hover:scale-110 active:scale-90 ${
            isFavorite ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-700"
          } ${justPopped ? "animate-heart-pop" : ""}`}
          aria-label="찜 토글"
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {scholarship.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <p className="text-slate-400">마감</p>
          <p className="font-medium text-slate-900">{scholarship.applyEnd ?? "미정"}</p>
        </div>
        <div>
          <p className="text-slate-400">적합도</p>
          <p className="font-medium text-slate-900">{scholarship.fitScore}/100</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setCriteriaOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="text-sm font-medium text-slate-800">판단 근거</span>
          <span className="flex items-center gap-2 text-xs font-medium">
            {criteria.length > 0 ? (
              <>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">충족 {metCount}</span>
                {unmetCount > 0 ? (
                  <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-700">미충족 {unmetCount}</span>
                ) : null}
              </>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">판단 불가</span>
            )}
            <span className="text-slate-400">{criteriaOpen ? "▲" : "▼"}</span>
          </span>
        </button>

        {criteriaOpen ? (
          <div className="border-t border-slate-100 p-4 pt-3">
            {criteria.length > 0 ? (
              <ul className="space-y-2">
                {criteria.map((criterion) => (
                  <li
                    key={criterion.key}
                    className={`rounded-xl px-3 py-2 text-sm ${criterion.met ? "bg-emerald-50" : "bg-rose-50"}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={criterion.met ? "text-emerald-600" : "text-rose-600"}>
                        {criterion.met ? "✓" : "✕"}
                      </span>
                      <div>
                        <p className={`font-medium ${criterion.met ? "text-emerald-900" : "text-rose-900"}`}>
                          {criterion.label}
                        </p>
                        <p className={criterion.met ? "text-emerald-700" : "text-rose-700"}>{criterion.detail}</p>
                        {criterion.actionHint ? (
                          <p className="mt-1 font-medium text-amber-700">💡 {criterion.actionHint}</p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                ⚠️ 이 장학금은 정량적 자격 조건(학년·평점·학점 등)이 데이터에 등록되어 있지 않아 자동으로 판단할 수
                없어요. 공식 공고를 직접 확인해주세요.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {scholarship.riskFlags.length > 0 ? (
        <div className="mt-3 rounded-2xl bg-slate-50">
          <button
            type="button"
            onClick={() => setRisksOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-sm font-medium text-slate-800">주의 사항 {scholarship.riskFlags.length}개</span>
            <span className="text-xs text-slate-400">{risksOpen ? "▲" : "▼"}</span>
          </button>
          {risksOpen ? (
            <ul className="space-y-1 px-4 pb-4 text-sm text-slate-600">
              {scholarship.riskFlags.map((flag) => (
                <li key={flag}>• {flag}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/scholarships/${scholarship.id}`}
          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition-all duration-150 hover:scale-105 active:scale-95"
        >
          상세 보기
        </Link>
        {scholarship.officialUrl ? (
          <a
            href={scholarship.officialUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-150 hover:scale-105 active:scale-95"
          >
            공고 링크
          </a>
        ) : null}
      </div>
    </article>
  );
}
