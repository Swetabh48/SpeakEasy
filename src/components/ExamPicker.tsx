"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MetaChip, Panel } from "@/components/Shell";
import {
  EXAM_CATALOG,
  estimateExamTopicSpace,
  searchExams,
  type Exam,
} from "@/lib/topics/engine";
import { formatSpace } from "@/lib/storage";

const PAGE_SIZE = 8;

type Props = {
  value: string | null;
  onChange: (examId: string | null) => void;
};

export function ExamPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 280);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(0);
  }, [debounced]);

  const filtered = useMemo(() => searchExams(debounced), [debounced]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = EXAM_CATALOG.find((e) => e.id === value) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">
          Optional — search and pick an exam you’re preparing for
        </p>
        {selected && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-red-400/40 hover:text-red-300"
          >
            <X className="h-3.5 w-3.5" /> Clear exam
          </button>
        )}
      </div>

      {selected && (
        <Panel className="flex flex-wrap items-center gap-2 p-3">
          <MetaChip>{selected.shortName}</MetaChip>
          <MetaChip>{selected.country}</MetaChip>
          <MetaChip>{formatSpace(estimateExamTopicSpace(selected, "speak"))} speak</MetaChip>
          <MetaChip>{formatSpace(estimateExamTopicSpace(selected, "essay"))} essays</MetaChip>
          <span className="text-sm text-[var(--ink)]">{selected.name}</span>
        </Panel>
      )}

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type exam name — UPSC, IELTS, FSOT, CAT…"
          className="w-full cursor-text rounded-2xl border border-[var(--line)] bg-[var(--void)] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[var(--accent)]"
        />
      </label>

      <div className="grid gap-2">
        {pageItems.map((exam) => (
          <ExamRow
            key={exam.id}
            exam={exam}
            active={value === exam.id}
            onSelect={() => onChange(exam.id)}
          />
        ))}
        {pageItems.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
            No exams match “{debounced}”.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          {filtered.length} matches · page {safePage + 1}/{pageCount}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full border border-[var(--line)] px-3 text-sm transition hover:border-[var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full border border-[var(--line)] px-3 text-sm transition hover:border-[var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ExamRow({
  exam,
  active,
  onSelect,
}: {
  exam: Exam;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full cursor-pointer items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/12 shadow-[0_0_0_1px_rgba(232,168,73,0.25)]"
          : "border-[var(--line)] bg-[var(--panel-2)]/40 hover:border-[var(--accent)]/45 hover:bg-[var(--panel-2)]"
      }`}
    >
      <div>
        <div className="font-display text-base font-medium">{exam.shortName}</div>
        <div className="mt-0.5 text-sm text-[var(--muted)]">{exam.name}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <MetaChip>{exam.country}</MetaChip>
          <MetaChip>{exam.continent}</MetaChip>
          <MetaChip>{exam.kind}</MetaChip>
        </div>
      </div>
      <div className="shrink-0 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">
        {formatSpace(estimateExamTopicSpace(exam, "speak"))}
      </div>
    </button>
  );
}
