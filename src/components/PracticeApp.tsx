"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  FileUp,
  History,
  Home,
  Mic,
  MicOff,
  RotateCcw,
  SkipForward,
  Timer,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExamPicker } from "@/components/ExamPicker";
import { BrandMark, MetaChip, Panel, Shell } from "@/components/Shell";
import type { EvaluationResult } from "@/lib/evaluation/types";
import { extractPdfText } from "@/lib/pdfText";
import { loadEvals, saveEvalFromResult, type StoredEval } from "@/lib/profile";
import {
  bumpStreak,
  loadHistory,
  loadSeenIds,
  loadSettings,
  loadStreak,
  markTopicSeen,
  pushHistory,
  saveSettings,
  type HistoryItem,
  type StreakState,
} from "@/lib/storage";
import {
  CATEGORIES,
  DIFFICULTIES,
  MODES,
  categoryLabel,
  difficultyLabel,
  drawTopic,
  getExamById,
  modeLabel,
  type Category,
  type Difficulty,
  type Mode,
  type Topic,
  type TopicFilters,
} from "@/lib/topics/engine";
import { getSttStrategy } from "@/lib/device";
import { transcribeViaServer } from "@/lib/serverTranscribe";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import { useBackupSpeechTranscript } from "@/lib/useBackupSpeechTranscript";
import { usePracticeTimer } from "@/lib/usePracticeTimer";
import { transcribeWithWhisper } from "@/lib/whisperTranscribe";

type Stage =
  | "ready"
  | "spinning"
  | "topic"
  | "prep"
  | "speak"
  | "write"
  | "review";

const PREP_OPTIONS = [15, 30, 45, 60];
const SPEAK_OPTIONS = [60, 90, 120, 180, 600];

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function requestEvaluation(payload: {
  kind: "speech" | "essay";
  topic: string;
  mode: string;
  examId: string | null;
  examName: string | null;
  difficulty: string;
  category: string;
  transcriptOrEssay: string;
  durationSec: number;
  targetSec: number;
}): Promise<EvaluationResult> {
  const res = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Evaluation failed");
  }
  return res.json();
}

export default function PracticeApp() {
  const [stage, setStage] = useState<Stage>("ready");
  const [mode, setMode] = useState<Mode>("impromptu");
  const [category, setCategory] = useState<Category>("all");
  const [customField, setCustomField] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [examId, setExamId] = useState<string | null>(null);
  const [prepSec, setPrepSec] = useState(30);
  const [speakSec, setSpeakSec] = useState(60);
  const [customPrep, setCustomPrep] = useState(false);
  const [customSpeak, setCustomSpeak] = useState(false);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [evals, setEvals] = useState<StoredEval[]>([]);
  const [streak, setStreak] = useState<StreakState>({
    current: 0,
    best: 0,
    lastPracticeDay: null,
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [feedback, setFeedback] = useState<EvaluationResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [transcribeStatus, setTranscribeStatus] = useState<string | null>(null);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [manualDraft, setManualDraft] = useState("");
  const [awaitingManualTranscript, setAwaitingManualTranscript] =
    useState(false);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [essayText, setEssayText] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const finishingRef = useRef(false);
  const speakStartedAt = useRef<number | null>(null);
  const lastDurationSec = useRef(0);

  const isEssay = mode === "essay";
  const isDeep = mode === "deep-research";
  const timer = usePracticeTimer(prepSec, speakSec);
  const recorder = useAudioRecorder();
  const backupSpeech = useBackupSpeechTranscript();
  const selectedExam = useMemo(() => getExamById(examId), [examId]);

  const filters: TopicFilters = {
    mode,
    category,
    difficulty,
    examId,
    customField: customField.trim() || null,
  };

  useEffect(() => {
    const settings = loadSettings();
    setPrepSec(settings.prepSec);
    setSpeakSec(settings.speakSec);
    setCustomPrep(!PREP_OPTIONS.includes(settings.prepSec));
    setCustomSpeak(!SPEAK_OPTIONS.includes(settings.speakSec));
    setSeen(loadSeenIds());
    setHistory(loadHistory());
    setEvals(loadEvals());
    setStreak(loadStreak());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSettings({ prepSec, speakSec });
  }, [prepSec, speakSec, hydrated]);

  useEffect(() => {
    if (timer.phase === "prep") setStage("prep");
    if (timer.phase === "speak") {
      if (isEssay) {
        setStage("write");
        if (speakStartedAt.current == null) speakStartedAt.current = Date.now();
        return;
      }
      setStage("speak");
      if (speakStartedAt.current == null) speakStartedAt.current = Date.now();
      backupSpeech.reset();

      const strategy = getSttStrategy();
      // iPad/iPhone: record only (Chrome there is still WebKit — captions unreliable).
      // Android Chrome: captions only (mic conflict with recorder).
      // Desktop: both.
      if (strategy === "captions") {
        backupSpeech.start();
      } else if (recorder.state === "idle" || recorder.state === "recorded") {
        void recorder.start().then(() => {
          if (strategy === "both") {
            window.setTimeout(() => backupSpeech.start(), 400);
          }
        });
      } else if (strategy === "both") {
        backupSpeech.start();
      }
    }
    if (timer.phase === "done") {
      if (isEssay) {
        setStage("write");
        timer.reset();
      } else {
        void finishSpeechSession();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.phase]);

  function goHome() {
    finishingRef.current = false;
    recorder.reset();
    backupSpeech.reset();
    timer.reset();
    speakStartedAt.current = null;
    setTopic(null);
    setFeedback(null);
    setEvalError(null);
    setTranscribeStatus(null);
    setFinalTranscript("");
    setManualDraft("");
    setAwaitingManualTranscript(false);
    setEssayText("");
    setPdfName(null);
    setEvaluating(false);
    setStage("ready");
  }

  function spinTopic() {
    finishingRef.current = false;
    setFeedback(null);
    setEvalError(null);
    setTranscribeStatus(null);
    setFinalTranscript("");
    setManualDraft("");
    setAwaitingManualTranscript(false);
    recorder.reset();
    backupSpeech.reset();
    timer.reset();
    speakStartedAt.current = null;
    setEssayText("");
    setPdfName(null);
    setStage("spinning");
    window.setTimeout(() => {
      const next = drawTopic(filters, seen);
      setSeen(markTopicSeen(next, seen));
      setTopic(next);
      setStage("topic");
    }, 700);
  }

  function beginPractice() {
    if (!topic) return;
    finishingRef.current = false;
    speakStartedAt.current = null;
    timer.startPrep();
  }

  function pushSessionHistory(durationSec: number, hadRecording: boolean) {
    if (!topic) return;
    setHistory(
      pushHistory({
        id: topic.id,
        text: topic.text,
        mode: topic.mode,
        category: topic.category,
        difficulty: topic.difficulty,
        practicedAt: Date.now(),
        durationSec,
        hadRecording,
      }),
    );
    setStreak(bumpStreak());
  }

  async function runSpeechEvaluation(transcript: string, durationSec: number) {
    if (!topic) return;
    setEvaluating(true);
    setEvalError(null);
    setAwaitingManualTranscript(false);
    setFinalTranscript(transcript);
    try {
      setTranscribeStatus(
        transcript
          ? "Scoring your attempt…"
          : "No speech detected — scoring as insufficient…",
      );
      const result = await requestEvaluation({
        kind: "speech",
        topic: topic.text,
        mode: topic.mode,
        examId: topic.examId,
        examName: topic.examName,
        difficulty: topic.difficulty,
        category: customField.trim() || topic.category,
        transcriptOrEssay: transcript,
        durationSec,
        targetSec: speakSec,
      });
      setFeedback(result);
      setEvals(
        saveEvalFromResult(
          {
            topic: topic.text,
            mode: topic.mode,
            examName: topic.examName,
            kind: "speech",
          },
          result,
        ),
      );
    } catch {
      setEvalError("Scoring couldn’t finish. Please try that session again.");
    } finally {
      setEvaluating(false);
      setTranscribeStatus(null);
      speakStartedAt.current = null;
    }
  }

  async function scoreManualTranscript() {
    const text = manualDraft.trim();
    if (!text || !topic) {
      setEvalError("Type or paste what you said, then score.");
      return;
    }
    finishingRef.current = true;
    pushSessionHistory(lastDurationSec.current, true);
    await runSpeechEvaluation(text, lastDurationSec.current);
  }

  async function finishSpeechSession() {
    if (!topic || finishingRef.current) return;
    finishingRef.current = true;

    const elapsedMs = speakStartedAt.current
      ? Date.now() - speakStartedAt.current
      : 0;
    const durationSec = Math.max(0, Math.round(elapsedMs / 1000));
    lastDurationSec.current = durationSec;
    const backupText = backupSpeech.getFinal() || backupSpeech.live.trim();
    backupSpeech.stop();

    setEvaluating(true);
    setEvalError(null);
    setAwaitingManualTranscript(false);
    setManualDraft("");
    setTranscribeStatus("Finalizing…");
    setStage("review");
    timer.reset();

    const strategy = getSttStrategy();
    let blob: Blob | null = null;
    try {
      if (recorder.state === "recording") {
        blob = await recorder.stop();
      } else {
        blob = recorder.audioBlob;
      }
    } catch {
      blob = recorder.audioBlob;
    }

    let transcript = backupText;

    // Cascade: captions → in-browser Whisper → optional server Whisper
    if ((!transcript || strategy === "both") && blob && blob.size > 800) {
      if (!transcript || strategy !== "captions") {
        const whisper = await transcribeWithWhisper(blob, setTranscribeStatus);
        if (whisper.text) {
          if (!transcript || whisper.text.length >= transcript.length) {
            transcript = whisper.text;
          }
        }
      }
    }

    if (!transcript && blob && blob.size > 800) {
      setTranscribeStatus("Trying cloud speech-to-text fallback…");
      const server = await transcribeViaServer(blob);
      if (server.text) transcript = server.text;
    }

    if (!transcript) {
      pushSessionHistory(durationSec, Boolean(blob && blob.size > 800));
      setFinalTranscript("");
      setAwaitingManualTranscript(true);
      setEvalError(
        "Automatic transcript failed on this device. Type or paste what you said below — you’ll still get a full evaluation.",
      );
      setEvaluating(false);
      setTranscribeStatus(null);
      speakStartedAt.current = null;
      finishingRef.current = false;
      return;
    }

    pushSessionHistory(
      durationSec,
      Boolean(blob && blob.size > 800) || Boolean(transcript),
    );
    await runSpeechEvaluation(transcript, durationSec);
  }

  async function onPdfSelected(file: File | null) {
    if (!file) return;
    setPdfName(file.name);
    setEvalError(null);
    try {
      const text = await extractPdfText(file);
      setEssayText(text);
      if (!text) setEvalError("Could not extract text from this PDF.");
    } catch {
      setEvalError("PDF read failed. Try a text-based PDF (not a photo scan).");
    }
  }

  async function scoreEssayPdf() {
    if (!topic || !essayText.trim()) {
      setEvalError("Upload a PDF with extractable essay text before scoring.");
      return;
    }
    finishingRef.current = true;
    const elapsedMs = speakStartedAt.current
      ? Date.now() - speakStartedAt.current
      : 0;
    const durationSec = Math.max(0, Math.round(elapsedMs / 1000));
    pushSessionHistory(durationSec, false);
    setEvaluating(true);
    setEvalError(null);
    setStage("review");
    timer.reset();
    try {
      const result = await requestEvaluation({
        kind: "essay",
        topic: topic.text,
        mode: "essay",
        examId: topic.examId,
        examName: topic.examName,
        difficulty: topic.difficulty,
        category: customField.trim() || topic.category,
        transcriptOrEssay: essayText,
        durationSec,
        targetSec: speakSec,
      });
      setFeedback(result);
      setEvals(
        saveEvalFromResult(
          {
            topic: topic.text,
            mode: "essay",
            examName: topic.examName,
            kind: "essay",
          },
          result,
        ),
      );
    } catch {
      setEvalError("Scoring couldn’t finish. Please try that session again.");
    } finally {
      setEvaluating(false);
      speakStartedAt.current = null;
    }
  }

  function endEssayWithoutScore() {
    if (!topic || finishingRef.current) return;
    finishingRef.current = true;
    const elapsedMs = speakStartedAt.current
      ? Date.now() - speakStartedAt.current
      : 0;
    const durationSec = Math.max(0, Math.round(elapsedMs / 1000));
    pushSessionHistory(durationSec, false);
    timer.reset();
    setFeedback(null);
    setStage("review");
    speakStartedAt.current = null;
  }

  const progress =
    timer.phase === "prep"
      ? 1 - timer.remaining / Math.max(prepSec, 1)
      : timer.phase === "speak"
        ? 1 - timer.remaining / Math.max(speakSec, 1)
        : 0;

  const inSession =
    stage === "spinning" ||
    stage === "topic" ||
    stage === "prep" ||
    stage === "speak" ||
    stage === "write";

  return (
    <Shell>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <button
          type="button"
          onClick={goHome}
          className="cursor-pointer rounded-2xl text-left transition hover:opacity-90"
          aria-label="Go to home"
        >
          <BrandMark />
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {stage !== "ready" && (
            <button
              type="button"
              onClick={goHome}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </button>
          )}
          <MetaChip>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            {hydrated ? `${seen.size} unique on device` : "…"}
          </MetaChip>
          <MetaChip>
            streak {streak.current} · best {streak.best}
          </MetaChip>
          <Link
            href="/profile"
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
          >
            <UserRound className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-10 sm:px-8">
        <AnimatePresence mode="wait">
          {stage === "ready" && (
            <motion.section
              key="ready"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-1 flex-col justify-center gap-10 py-6"
            >
              <div className="max-w-3xl">
                <p className="mb-4 font-mono text-xs uppercase tracking-[0.28em] text-[var(--accent)]">
                  Speech & essay lab
                </p>
                <h1 className="font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
                  Speakeasy
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--muted)] sm:text-xl">
                  Practice speaking and essays with exam-style feedback
                  {selectedExam ? ` for ${selectedExam.shortName}` : ""}. Scores
                  reflect what you actually said or wrote.
                </p>
              </div>

              <Panel className="grid gap-6 p-5 sm:p-7">
                <ControlBlock label="Preparing for exam (optional)">
                  <ExamPicker value={examId} onChange={setExamId} />
                </ControlBlock>

                <ControlBlock label="Mode">
                  <div className="flex flex-wrap gap-2">
                    {MODES.map((m) => (
                      <SegButton
                        key={m}
                        active={mode === m}
                        onClick={() => {
                          setMode(m);
                          if (m === "essay") {
                            if (!customSpeak && speakSec < 600) setSpeakSec(600);
                            if (!customPrep && prepSec < 60) setPrepSec(60);
                          }
                          if (m === "deep-research") {
                            setPrepSec(600);
                            setCustomPrep(false);
                            if (speakSec < 60 || speakSec > 300) {
                              setSpeakSec(180);
                              setCustomSpeak(false);
                            }
                          }
                        }}
                      >
                        {modeLabel(m)}
                      </SegButton>
                    ))}
                  </div>
                  {mode === "essay" && (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Essay mode is writing — no mic. Upload a PDF to score, or end without a score.
                    </p>
                  )}
                  {mode === "deep-research" && (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Heavy topic · default 10 min research then 1–5 min speak. Dig into mechanisms and evidence — slogans will score poorly.
                    </p>
                  )}
                </ControlBlock>

                <ControlBlock label="Field / domain">
                  <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
                    {CATEGORIES.map((c) => (
                      <SegButton
                        key={c}
                        active={!customField && category === c}
                        onClick={() => {
                          setCustomField("");
                          setCategory(c);
                        }}
                      >
                        {categoryLabel(c)}
                      </SegButton>
                    ))}
                  </div>
                  <input
                    value={customField}
                    onChange={(e) => setCustomField(e.target.value)}
                    placeholder="Or type any field — nutrition policy, maritime law…"
                    className="mt-3 w-full rounded-2xl border border-[var(--line)] bg-[var(--void)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </ControlBlock>

                <ControlBlock label="Difficulty">
                  <div className="flex flex-wrap gap-2">
                    {DIFFICULTIES.map((d) => (
                      <SegButton
                        key={d}
                        active={difficulty === d}
                        onClick={() => setDifficulty(d)}
                      >
                        {difficultyLabel(d)}
                      </SegButton>
                    ))}
                  </div>
                </ControlBlock>

                <div className="grid gap-6 sm:grid-cols-2">
                  {!isDeep && (
                    <ControlBlock label="Prep timer">
                      <div className="flex flex-wrap gap-2">
                        {PREP_OPTIONS.map((n) => (
                          <SegButton
                            key={n}
                            active={!customPrep && prepSec === n}
                            onClick={() => {
                              setCustomPrep(false);
                              setPrepSec(n);
                            }}
                          >
                            {n}s
                          </SegButton>
                        ))}
                        <SegButton active={customPrep} onClick={() => setCustomPrep(true)}>
                          Custom
                        </SegButton>
                      </div>
                      {customPrep && (
                        <CustomSeconds value={prepSec} min={5} max={600} onChange={setPrepSec} suffix="sec prep" />
                      )}
                    </ControlBlock>
                  )}
                  <ControlBlock label={isEssay ? "Write timer" : isDeep ? "Speak after research" : "Speak timer"}>
                    <div className="flex flex-wrap gap-2">
                      {(isDeep ? [60, 120, 180, 240, 300] : SPEAK_OPTIONS).map((n) => (
                        <SegButton
                          key={n}
                          active={!customSpeak && speakSec === n}
                          onClick={() => {
                            setCustomSpeak(false);
                            setSpeakSec(n);
                          }}
                        >
                          {n >= 60 ? `${n / 60}m` : `${n}s`}
                        </SegButton>
                      ))}
                      <SegButton active={customSpeak} onClick={() => setCustomSpeak(true)}>
                        Custom
                      </SegButton>
                    </div>
                    {customSpeak && (
                      <CustomSeconds
                        value={speakSec}
                        min={isDeep ? 60 : 15}
                        max={isDeep ? 300 : 1800}
                        onChange={setSpeakSec}
                        suffix="sec"
                      />
                    )}
                  </ControlBlock>
                </div>

                {isDeep && (
                  <ControlBlock label="Research window">
                    <div className="flex flex-wrap gap-2">
                      {[300, 600, 900].map((n) => (
                        <SegButton
                          key={n}
                          active={!customPrep && prepSec === n}
                          onClick={() => {
                            setCustomPrep(false);
                            setPrepSec(n);
                          }}
                        >
                          {n / 60}m research
                        </SegButton>
                      ))}
                      <SegButton
                        active={customPrep}
                        onClick={() => setCustomPrep(true)}
                      >
                        Custom
                      </SegButton>
                    </div>
                    {customPrep && (
                      <CustomSeconds
                        value={prepSec}
                        min={120}
                        max={1800}
                        onChange={setPrepSec}
                        suffix="sec research"
                      />
                    )}
                  </ControlBlock>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[var(--muted)]">
                    Pick your mode, field, and timers — then spin a topic and practice.
                  </p>
                  <button
                    type="button"
                    onClick={spinTopic}
                    className="group inline-flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-8 font-display text-lg font-semibold text-[var(--void)] transition hover:brightness-110 active:scale-[0.98]"
                  >
                    Spin a topic
                  </button>
                </div>
              </Panel>
            </motion.section>
          )}

          {inSession && (
            <motion.section
              key="session"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-1 flex-col justify-center gap-6 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <MetaChip>{modeLabel(mode)}</MetaChip>
                <MetaChip>
                  {customField.trim() || categoryLabel(category)}
                </MetaChip>
                <MetaChip>{difficultyLabel(difficulty)}</MetaChip>
                {selectedExam && <MetaChip>{selectedExam.shortName}</MetaChip>}
              </div>

              <Panel className="relative overflow-hidden p-6 sm:p-10">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/50 to-transparent" />
                {stage === "spinning" ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-4">
                    <motion.div
                      className="h-16 w-16 rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    />
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                      Drawing unused topic…
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--teal)]">
                      Your topic
                    </p>
                    <motion.h2
                      key={topic?.id}
                      initial={{ opacity: 0, filter: "blur(8px)", y: 10 }}
                      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                      className="max-w-4xl font-display text-2xl font-medium leading-snug tracking-tight sm:text-4xl"
                    >
                      {topic?.text}
                    </motion.h2>
                    <div className="mt-6 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                      {topic?.region && <span>{topic.region}</span>}
                      {topic?.examName && (
                        <>
                          <span className="opacity-40">/</span>
                          <span>{topic.examName}</span>
                        </>
                      )}
                    </div>
                  </>
                )}
              </Panel>

              {(stage === "prep" || stage === "speak" || stage === "write") && (
                <Panel className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-center gap-4">
                      <Ring progress={progress} remaining={timer.remaining} accent={stage === "prep" ? "accent" : "teal"} />
                      <div>
                        <div className="flex items-center gap-2 font-display text-xl">
                          <Timer className="h-5 w-5 text-[var(--muted)]" />
                          {stage === "prep"
                            ? isDeep
                              ? "Deep research window"
                              : "Prep window"
                            : isEssay
                              ? "Write your essay"
                              : "Speak now"}
                        </div>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {stage === "prep"
                            ? isDeep
                              ? "Open tabs, take notes, find mechanisms & counterevidence. Then speak 1–5 minutes."
                              : "Outline thesis · pillars · close"
                            : isEssay
                              ? "Write on paper/docs, then upload PDF to score — or end with no score."
                              : "Recording now. Your speech will be transcribed after you finish, then scored."}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {stage === "prep" && (
                        <button
                          type="button"
                          onClick={() => timer.skipToSpeak()}
                          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] px-4 text-sm transition hover:border-[var(--teal)]/50"
                        >
                          <SkipForward className="h-4 w-4" />
                          {isDeep ? "Research done — speak" : "Skip prep"}
                        </button>
                      )}
                      {stage === "speak" && (
                        <>
                          <StatusMic state={recorder.state} />
                          <button
                            type="button"
                            onClick={() => void finishSpeechSession()}
                            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-[var(--teal)] px-5 text-sm font-semibold text-[var(--void)]"
                          >
                            Finish & evaluate
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {stage === "speak" && (
                    <p className="mt-4 max-h-28 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3 text-sm text-[var(--muted)]">
                      {getSttStrategy() === "record" ? (
                        <>
                          <span className="text-[var(--teal)]">Recording · </span>
                          {`Keep speaking — on iPad/iPhone we score from the saved audio (and fallbacks), not live captions.`}
                        </>
                      ) : (
                        <>
                          <span className="text-[var(--teal)]">Live captions · </span>
                          {backupSpeech.live
                            ? backupSpeech.live
                            : getSttStrategy() === "captions"
                              ? "Listening… keep this browser open with internet so captions can score this session."
                              : "Listening… scoring still uses the full recording if captions pause."}
                        </>
                      )}
                    </p>
                  )}

                  {stage === "write" && (
                    <div className="mt-5 space-y-3">
                      <label className="flex cursor-pointer flex-col items-start gap-2 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel-2)] px-4 py-5 transition hover:border-[var(--accent)]/45">
                        <span className="inline-flex items-center gap-2 text-sm">
                          <FileUp className="h-4 w-4 text-[var(--accent)]" />
                          Upload essay PDF {pdfName ? `· ${pdfName}` : ""}
                        </span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => void onPdfSelected(e.target.files?.[0] ?? null)}
                        />
                        {essayText && (
                          <span className="text-xs text-[var(--muted)]">
                            Extracted {essayText.split(/\s+/).filter(Boolean).length} words
                          </span>
                        )}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void scoreEssayPdf()}
                          disabled={!essayText.trim() || evaluating}
                          className="inline-flex h-11 cursor-pointer items-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--void)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Score my PDF
                        </button>
                        <button
                          type="button"
                          onClick={endEssayWithoutScore}
                          className="inline-flex h-11 cursor-pointer items-center rounded-full border border-[var(--line)] px-5 text-sm transition hover:border-[var(--accent)]/40"
                        >
                          End without score
                        </button>
                      </div>
                      {evalError && (
                        <p className="text-sm text-red-300">{evalError}</p>
                      )}
                    </div>
                  )}
                </Panel>
              )}

              {stage === "topic" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={goHome} className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] px-5 text-sm">
                      <Home className="h-4 w-4" /> Home
                    </button>
                    <button type="button" onClick={spinTopic} className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] px-5 text-sm">
                      <RotateCcw className="h-4 w-4" /> Spin again
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={beginPractice}
                    className="inline-flex h-12 cursor-pointer items-center justify-center rounded-full bg-[var(--accent)] px-8 font-display font-semibold text-[var(--void)]"
                  >
                    Start {isDeep ? `${prepSec / 60}m research` : `${prepSec}s prep`}
                  </button>
                </div>
              )}

              {(stage === "prep" || stage === "speak" || stage === "write" || stage === "spinning") && (
                <button
                  type="button"
                  onClick={goHome}
                  className="self-start cursor-pointer text-sm text-[var(--muted)] underline-offset-4 hover:text-[var(--accent)] hover:underline"
                >
                  ← Back to home & filters
                </button>
              )}
            </motion.section>
          )}

          {stage === "review" && (
            <motion.section
              key="review"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col gap-6 py-4"
            >
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                  Session review
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  {evaluating
                    ? selectedExam
                      ? "Evaluating against exam standards…"
                      : "Evaluating…"
                    : feedback
                      ? "Evidence-based result"
                      : awaitingManualTranscript
                        ? "Transcript needed"
                        : "Ended without score"}
                </h2>
                {!evaluating && feedback && (
                  <p className="mt-3 max-w-2xl text-[var(--muted)]">{feedback.overall}</p>
                )}
                {!evaluating && !feedback && awaitingManualTranscript && (
                  <p className="mt-3 max-w-2xl text-[var(--muted)]">
                    Automatic speech-to-text couldn’t finish on this device. Type
                    or paste what you said — scoring uses the same evaluator as
                    desktop.
                  </p>
                )}
                {!evaluating && !feedback && !awaitingManualTranscript && (
                  <p className="mt-3 max-w-2xl text-[var(--muted)]">
                    Practice logged. No marks awarded because you chose to end without submitting content for scoring.
                  </p>
                )}
                {evalError && <p className="mt-2 text-sm text-red-300">{evalError}</p>}
              </div>

              {evaluating && (
                <Panel className="flex min-h-40 flex-col items-center justify-center gap-2 p-8 text-sm text-[var(--muted)]">
                  <span>{transcribeStatus || "Working…"}</span>
                </Panel>
              )}

              {!evaluating && awaitingManualTranscript && (
                <Panel className="p-5 sm:p-6">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                    Type what you said
                  </p>
                  {recorder.audioUrl && (
                    <div className="mb-4">
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                        Playback (optional)
                      </p>
                      <audio controls src={recorder.audioUrl} className="w-full" />
                    </div>
                  )}
                  <textarea
                    value={manualDraft}
                    onChange={(e) => setManualDraft(e.target.value)}
                    rows={6}
                    placeholder="Replay your recording if available, then type the words you spoke…"
                    className="w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]/50"
                  />
                  <button
                    type="button"
                    onClick={() => void scoreManualTranscript()}
                    disabled={!manualDraft.trim()}
                    className="mt-4 inline-flex h-12 cursor-pointer items-center justify-center rounded-full bg-[var(--accent)] px-8 font-display font-semibold text-[var(--void)] disabled:opacity-40"
                  >
                    Score my transcript
                  </button>
                </Panel>
              )}

              {!evaluating && finalTranscript && !awaitingManualTranscript && (
                <Panel className="p-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                    Your transcript
                  </p>
                  <p className="max-h-36 overflow-y-auto text-sm text-[var(--muted)]">
                    {finalTranscript}
                  </p>
                </Panel>
              )}

              {feedback && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <MetaChip>{feedback.band}</MetaChip>
                    <MetaChip>overall {feedback.overallScore}</MetaChip>
                    <MetaChip>{feedback.wordCount} words</MetaChip>
                    <MetaChip>
                      {feedback.durationSec}s / {feedback.targetSec}s
                    </MetaChip>
                    {feedback.insufficientEvidence && (
                      <MetaChip>insufficient evidence</MetaChip>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {feedback.scores.map((s) => (
                      <Panel key={s.label} className="p-5">
                        <div className="flex items-end justify-between">
                          <span className="font-display text-lg">{s.label}</span>
                          <span className="font-mono text-2xl text-[var(--accent)]">
                            {s.value}
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${s.value}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--teal)]"
                          />
                        </div>
                        <p className="mt-3 text-sm text-[var(--muted)]">{s.note}</p>
                      </Panel>
                    ))}
                  </div>
                  <Panel className="p-5 sm:p-6">
                    <h3 className="font-display text-xl">Coaching</h3>
                    <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                      {feedback.tips.map((tip) => (
                        <li key={tip} className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--teal)]" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                    {feedback.transcriptUsed && (
                      <div className="mt-5">
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                          What was scored
                        </p>
                        <p className="max-h-40 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3 text-sm text-[var(--muted)]">
                          {feedback.transcriptUsed || "(empty)"}
                        </p>
                      </div>
                    )}
                    {!isEssay && recorder.audioUrl && (
                      <div className="mt-5">
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                          Optional playback
                        </p>
                        <audio controls src={recorder.audioUrl} className="w-full" />
                      </div>
                    )}
                  </Panel>
                </>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={goHome}
                  className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--line)] px-5 text-sm"
                >
                  <Home className="h-4 w-4" /> Back to home
                </button>
                <button
                  type="button"
                  onClick={spinTopic}
                  className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-8 font-display font-semibold text-[var(--void)]"
                >
                  Another topic
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {historyOpen && (
          <HistoryDrawer
            history={history}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </AnimatePresence>
    </Shell>
  );
}

function HistoryDrawer({
  history,
  onClose,
}: {
  history: HistoryItem[];
  onClose: () => void;
}) {
  return (
    <motion.aside
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--line)] bg-[var(--void)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl">Practice history</h3>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-full border border-[var(--line)] p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto">
          {history.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No sessions yet.</p>
          )}
          {history.map((h) => (
            <div key={`${h.id}-${h.practicedAt}`} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="mb-2 flex flex-wrap gap-2">
                <MetaChip>{h.mode}</MetaChip>
                <MetaChip>{h.durationSec}s</MetaChip>
              </div>
              <p className="text-sm">{h.text}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.aside>
  );
}

function ControlBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </div>
      {children}
    </div>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3.5 py-2 text-sm transition active:scale-[0.98] ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--ink)]"
          : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]/45 hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function CustomSeconds({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  suffix: string;
}) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        className="w-28 rounded-xl border border-[var(--line)] bg-[var(--void)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <span className="text-sm text-[var(--muted)]">{suffix}</span>
    </div>
  );
}

function Ring({
  progress,
  remaining,
  accent,
}: {
  progress: number;
  remaining: number;
  accent: "accent" | "teal";
}) {
  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
        <path
          className="text-[var(--line)]"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          className={accent === "accent" ? "text-[var(--accent)]" : "text-[var(--teal)]"}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={`${Math.max(progress, 0.01) * 100}, 100`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono text-sm">
        {formatTime(remaining)}
      </div>
    </div>
  );
}

function StatusMic({
  state,
}: {
  state: ReturnType<typeof useAudioRecorder>["state"];
}) {
  if (state === "denied") {
    return (
      <span className="inline-flex h-11 items-center gap-2 rounded-full border border-red-400/40 px-4 text-sm text-red-300">
        <MicOff className="h-4 w-4" /> Mic blocked
      </span>
    );
  }
  if (state === "unsupported") {
    return (
      <span className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-sm text-[var(--muted)]">
        <MicOff className="h-4 w-4" /> Mic unavailable
      </span>
    );
  }
  if (state === "recording") {
    return (
      <span className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-4 text-sm text-[var(--teal)]">
        <Mic className="h-4 w-4" /> Recording
      </span>
    );
  }
  return (
    <span className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--line)] px-4 text-sm text-[var(--muted)]">
      <Mic className="h-4 w-4" /> Mic ready
    </span>
  );
}
