"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Scholarship, ScholarshipStatus } from "@/lib/scholarships";
import FilterBar from "@/components/dashboard/filter-bar";
import ScholarshipCard from "@/components/dashboard/scholarship-card";
import { useFavoritesStore } from "@/store/useFavoritesStore";

type Props = {
  scholarships: Scholarship[];
};

type SortKey = "deadline" | "amount" | "fit";
type TabKey = ScholarshipStatus | "FAVORITES";

const statusOrder: ScholarshipStatus[] = ["ELIGIBLE", "CONDITIONAL", "INELIGIBLE"];

export default function DashboardClient({ scholarships }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("ELIGIBLE");
  const [sortKey, setSortKey] = useState<SortKey>("fit");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const favorites = useFavoritesStore((state) => state.favorites);

  const allTags = useMemo(
    () => Array.from(new Set(scholarships.flatMap((scholarship) => scholarship.tags))).sort(),
    [scholarships],
  );

  const scopedScholarships = useMemo(() => {
    const base =
      activeTab === "FAVORITES"
        ? scholarships.filter((scholarship) => favorites.includes(scholarship.id))
        : scholarships.filter((scholarship) => scholarship.status === activeTab);

    return base
      .filter((scholarship) =>
        activeTags.length ? activeTags.every((tag) => scholarship.tags.includes(tag)) : true,
      )
      .sort((left, right) => {
        if (sortKey === "fit") return right.fitScore - left.fitScore;
        if (sortKey === "amount") return (right.amountMaxKrw ?? 0) - (left.amountMaxKrw ?? 0);
        const leftEnd = left.applyEnd ? new Date(left.applyEnd).getTime() : Number.MAX_SAFE_INTEGER;
        const rightEnd = right.applyEnd ? new Date(right.applyEnd).getTime() : Number.MAX_SAFE_INTEGER;
        return leftEnd - rightEnd;
      });
  }, [activeTags, activeTab, favorites, scholarships, sortKey]);

  function toggleTag(tag: string) {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag],
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl shadow-slate-300/20">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-semibold tracking-[0.25em] text-cyan-300">SKKOLARSHIP</p>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              로그아웃
            </button>
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
                className="rounded-xl border border-white/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                정보 수정
              </Link>
              <Link
                href="/onboarding/upload"
                className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                성적증명서 재업로드
              </Link>
            </div>
          </div>
        </div>

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {([...statusOrder, "FAVORITES"] as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab === "FAVORITES" ? "찜한 장학금" : tab}
                </button>
              ))}
            </div>

            <FilterBar sortKey={sortKey} onSortChange={setSortKey} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-2 text-sm transition ${
                  activeTags.includes(tag)
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

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
      </div>
    </main>
  );
}

