"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Scholarship, ScholarshipStatus } from "@/lib/scholarships";
import { SCHOLARSHIP_STATUS_LABELS } from "@/lib/scholarships";
import type { CombinationResult } from "@/engine/bestCombination";
import Logo from "@/components/brand/logo";
import FilterBar from "@/components/dashboard/filter-bar";
import ScholarshipCard from "@/components/dashboard/scholarship-card";
import ScholarshipCalendar from "@/components/dashboard/scholarship-calendar";
import BestCombinationCard from "@/components/dashboard/best-combination-card";
import { useFavoritesStore } from "@/store/useFavoritesStore";

type Props = {
  scholarships: Scholarship[];
  combination: CombinationResult;
  userName: string | null;
};

type SortKey = "deadline" | "amount" | "fit";
type TabKey = ScholarshipStatus | "FAVORITES" | "CALENDAR";

const statusOrder: ScholarshipStatus[] = ["ELIGIBLE", "CONDITIONAL", "INELIGIBLE"];

const TAB_LABELS: Record<TabKey, string> = {
  ...SCHOLARSHIP_STATUS_LABELS,
  FAVORITES: "찜한 장학금",
  CALENDAR: "찜한 장학금 캘린더",
};

export default function DashboardClient({ scholarships, combination, userName }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("ELIGIBLE");
  const [sortKey, setSortKey] = useState<SortKey>("fit");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const favorites = useFavoritesStore((state) => state.favorites);

  const allTags = useMemo(
    () => Array.from(new Set(scholarships.flatMap((scholarship) => scholarship.tags))).sort(),
    [scholarships],
  );

  const favoriteScholarships = useMemo(
    () => scholarships.filter((scholarship) => favorites.includes(scholarship.id)),
    [scholarships, favorites],
  );

  const scopedScholarships = useMemo(() => {
    const base =
      activeTab === "FAVORITES"
        ? favoriteScholarships
        : activeTab === "CALENDAR"
          ? []
          : scholarships.filter((scholarship) => scholarship.status === activeTab);

    return base
      .filter((scholarship) =>
        activeTags.length ? activeTags.some((tag) => scholarship.tags.includes(tag)) : true,
      )
      .sort((left, right) => {
        if (sortKey === "fit") return right.fitScore - left.fitScore;
        if (sortKey === "amount") return (right.amountMaxKrw ?? 0) - (left.amountMaxKrw ?? 0);
        const leftEnd = left.applyEnd ? new Date(left.applyEnd).getTime() : Number.MAX_SAFE_INTEGER;
        const rightEnd = right.applyEnd ? new Date(right.applyEnd).getTime() : Number.MAX_SAFE_INTEGER;
        return leftEnd - rightEnd;
      });
  }, [activeTags, activeTab, favoriteScholarships, scholarships, sortKey]);

  function toggleTag(tag: string) {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag],
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-10 sm:px-6 lg:px-10">
        <div
          className="rounded-[2rem] p-8 text-white shadow-xl shadow-slate-300/20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 15%, rgba(52,184,128,0.30), transparent 55%), " +
              "linear-gradient(180deg, rgba(4,13,25,0.96) 0%, rgba(7,21,38,0.94) 55%, rgba(4,13,25,1) 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <Logo size="sm" tone="light" withCaption={false} />
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href="/admin/scholarships"
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:scale-105 hover:bg-white/10 active:scale-95"
              >
                공고 자동 등록
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:scale-105 hover:bg-white/10 active:scale-95"
              >
                로그아웃
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold sm:text-4xl">장학금 대시보드</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                지원 가능성, 조건부 가능성, 찜한 장학금을 한곳에서 확인할 수 있습니다.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/onboarding/common"
                className="rounded-xl border border-white/20 px-4 py-3 text-sm font-medium text-white transition-all duration-150 hover:scale-105 hover:bg-white/10 active:scale-95"
              >
                정보 수정
              </Link>
              <Link
                href="/onboarding/upload"
                className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-all duration-150 hover:scale-105 hover:bg-cyan-400 active:scale-95"
              >
                성적증명서 재업로드
              </Link>
            </div>
          </div>
        </div>

        <BestCombinationCard combination={combination} userName={userName} />

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {([...statusOrder, "FAVORITES", "CALENDAR"] as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 hover:scale-105 active:scale-95 ${
                    activeTab === tab
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {activeTab !== "CALENDAR" ? <FilterBar sortKey={sortKey} onSortChange={setSortKey} /> : null}
          </div>

          {activeTab !== "CALENDAR" ? (
            <div className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
              {allTags.map((tag, index) => (
                <span key={tag} className="flex items-center">
                  {index > 0 ? <span className="mr-1 text-slate-300">|</span> : null}
                  <button
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-md px-1 py-0.5 transition-all duration-150 hover:scale-110 ${
                      activeTags.includes(tag)
                        ? "font-semibold text-pine-700 underline underline-offset-4"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tag}
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </section>

        {activeTab === "CALENDAR" ? (
          <ScholarshipCalendar scholarships={favoriteScholarships} />
        ) : (
          <>
            <section className="mt-8 grid gap-5 lg:grid-cols-2">
              {scopedScholarships.map((scholarship) => (
                <ScholarshipCard key={scholarship.id} scholarship={scholarship} />
              ))}
            </section>

            {scopedScholarships.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                선택한 조건에 맞는 장학금이 없습니다.
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

