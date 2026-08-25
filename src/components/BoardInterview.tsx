"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { BoardPanelRoom } from "@/components/BoardPanelRoom";
import { DAFIntakeForm } from "@/components/DAFIntakeForm";
import { ProctorOverlay } from "@/components/ProctorOverlay";
import { MetaChip, Panel } from "@/components/Shell";
import {
  checkBackendHealth,
  createBoardSession,
  fetchBoardDebrief,
  fetchBoardQuestion,
  submitBoardAnswer,
} from "@/lib/boardApi";
import {
  BOARD_PANEL,
  getPanelMember,
  type PanelMember,
} from "@/lib/boardPanel";
import {
  exitBoardFullscreen,
  requestBoardFullscreen,
  speakAsMember,
  speakDisciplineWarning,
  stopBoardSpeech,
} from "@/lib/boardSpeech";
import {
  clarifyQuestionText,
  containsAbusiveLanguage,
  isClarifyRequest,
  isMetaQuestionRequest,
  isRepeatRequest,
} from "@/lib/boardIntent";
import { isMobileLike } from "@/lib/device";
import type { ViolationKind } from "@/lib/proctor/types";
import { sanitizeTranscript } from "@/lib/transcriptClean";
import type { BoardTurn, CandidateProfile, ToolTrace } from "@/lib/topics/board";
import { trackLabel } from "@/lib/topics/board";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import { useBackupSpeechTranscript } from "@/lib/useBackupSpeechTranscript";
import { useProctorCamera } from "@/lib/useProctorCamera";
import { transcribeInBrowser } from "@/lib/whisperTranscribe";

type Phase = "intake" | "live" | "ended";

type DebriefPayload = Awaited<ReturnType<typeof fetchBoardDebrief>>;

const TAKE_YOUR_TIME_MS = 12_000;
const RAMBLE_MS = 75_000;

export function BoardInterview() {
  const [phase, setPhase] = useState<Phase>("intake");
  const [busy, setBusy] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [turns, setTurns] = useState<BoardTurn[]>([]);
  const [currentQ, setCurrentQ] = useState<string | null>(null);
  const [speaker, setSpeaker] = useState<PanelMember | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [trace, setTrace] = useState<ToolTrace | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [answering, setAnswering] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [debrief, setDebrief] = useState<DebriefPayload | null>(null);
  const roomRef = useRef<HTMLDivElement | null>(null);
  const pauseCueTimer = useRef<number | null>(null);
  const rambleTimer = useRef<number | null>(null);
  const answeredStartedRef = useRef(false);
  const takeTimeSaidRef = useRef(false);
  const submitLock = useRef(false);
  /** All discipline events this session (proctor buffer is cleared after each answer). */
  const sessionViolations = useRef<
    { kind: ViolationKind; atMs: number }[]
  >([]);

  const recorder = useAudioRecorder();
  const captions = useBackupSpeechTranscript();
  const proctor = useProctorCamera(phase === "live");

  const clearPaceTimers = useCallback(() => {
    if (pauseCueTimer.current) {
      window.clearTimeout(pauseCueTimer.current);
      pauseCueTimer.current = null;
    }
    if (rambleTimer.current) {
      window.clearTimeout(rambleTimer.current);
      rambleTimer.current = null;
    }
  }, []);

  useEffect(() => {
    void checkBackendHealth().then(setBackendOk);
  }, []);

  useEffect(() => {
    if (phase !== "live") {
      proctor.setOnViolation(null);
      return;
    }
    proctor.setOnViolation((kind: ViolationKind) => {
      sessionViolations.current.push({ kind, atMs: Date.now() });
      const stern = getPanelMember("member-d");
      setStatus(`Discipline: ${kind.replace(/-/g, " ")}`);
      speakDisciplineWarning(kind, stern);
    });
    return () => proctor.setOnViolation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    return () => {
      stopBoardSpeech();
      clearPaceTimers();
      void exitBoardFullscreen();
    };
  }, [clearPaceTimers]);

  useEffect(() => {
    const sync = () => setIsFs(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const scheduleTakeYourTime = useCallback(
    (member: PanelMember) => {
      takeTimeSaidRef.current = false;
      answeredStartedRef.current = false;
      if (pauseCueTimer.current) window.clearTimeout(pauseCueTimer.current);
      pauseCueTimer.current = window.setTimeout(() => {
        if (answeredStartedRef.current || takeTimeSaidRef.current) return;
        takeTimeSaidRef.current = true;
        const chair = getPanelMember("chair");
        setStatus(`${chair.name}: take your time…`);
        speakAsMember("Take your time.", chair);
      }, TAKE_YOUR_TIME_MS);
    },
    [],
  );

  const askNext = useCallback(
    async (sid: string) => {
      clearPaceTimers();
      setStatus("Agent deliberating…");
      setSpeaking(false);
      stopBoardSpeech();
      const res = await fetchBoardQuestion(sid);
      const member = getPanelMember(res.speakerId || undefined);
      setSpeaker(member);
      setCurrentQ(res.question);
      setIsFollowUp(Boolean(res.isFollowUp));
      setCategory(res.category || null);
      setTrace(res.trace);
      setTurns((prev) => [
        ...prev,
        {
          role: "board",
          text: res.question,
          timestampMs: Date.now(),
          speakerId: member.id,
          speakerName: member.name,
          category: res.category || undefined,
          isFollowUp: Boolean(res.isFollowUp),
        },
      ]);
      const label = res.isFollowUp
        ? `${member.name} is following up…`
        : `${member.name} (${member.role}) is speaking…`;
      setStatus(label);
      setSpeaking(true);
      speakAsMember(res.question, member, () => {
        setSpeaking(false);
        setStatus("Your turn — press Answer when ready.");
        scheduleTakeYourTime(member);
      });
    },
    [clearPaceTimers, scheduleTakeYourTime],
  );

  async function startSession(p: CandidateProfile) {
    setBusy(true);
    setError(null);
    setDebrief(null);
    try {
      const ok = await checkBackendHealth();
      setBackendOk(ok);
      if (!ok) {
        throw new Error(
          "Board API is offline. Start the FastAPI backend on :8000.",
        );
      }
      const session = await createBoardSession(p);
      setSessionId(session.sessionId);
      setProfile(p);
      setTurns([]);
      sessionViolations.current = [];
      setPhase("live");
      window.setTimeout(() => {
        void requestBoardFullscreen(
          roomRef.current || document.documentElement,
        );
      }, 50);
      await askNext(session.sessionId);
    } finally {
      setBusy(false);
    }
  }

  async function captureAnswerText(): Promise<string> {
    const caption = sanitizeTranscript(captions.getFinal() || captions.live);
    captions.stop();

    let blob: Blob | null = null;
    try {
      if (recorder.state === "recording") blob = await recorder.stop();
      else blob = recorder.audioBlob;
    } catch {
      blob = recorder.audioBlob;
    }

    let text = caption;
    if (blob && blob.size > 800) {
      setStatus("Transcribing your answer…");
      const local = await transcribeInBrowser(blob, setStatus, isMobileLike());
      if (local.text) {
        const clean = sanitizeTranscript(local.text);
        if (!text || clean.length >= text.length * 0.7) text = clean;
      }
    }
    if (!text) text = sanitizeTranscript(answerDraft);
    return text;
  }

  async function beginAnswer() {
    if (speaking) stopBoardSpeech();
    setSpeaking(false);
    setError(null);
    setAnswerDraft("");
    setAnswering(true);
    answeredStartedRef.current = true;
    if (pauseCueTimer.current) {
      window.clearTimeout(pauseCueTimer.current);
      pauseCueTimer.current = null;
    }
    captions.reset();
    recorder.reset();
    await recorder.start();
    if (!isMobileLike()) {
      window.setTimeout(() => captions.start(), 400);
    }
    setStatus("Listening… the panel is waiting. Press Stop & submit when done.");

    // Soft interrupt if the answer runs very long
    if (rambleTimer.current) window.clearTimeout(rambleTimer.current);
    rambleTimer.current = window.setTimeout(() => {
      if (!answeredStartedRef.current) return;
      const chair = getPanelMember("chair");
      setStatus(`${chair.name}: wrapping up…`);
      speakAsMember(
        "Thank you — that is enough for now. Let us move on.",
        chair,
        () => {
          void submitAnswer({ fromRamble: true });
        },
      );
    }, RAMBLE_MS);
  }

  async function submitAnswer(opts?: { fromRamble?: boolean }) {
    if (!sessionId || submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setError(null);
    setAnswering(false);
    clearPaceTimers();
    try {
      const text = await captureAnswerText();
      if (!text) {
        setError("No answer captured. Speak again or type below.");
        setBusy(false);
        submitLock.current = false;
        return;
      }
      setAnswerDraft(text);

      // Abuse: real boards do not ignore this — reprimand and hold the same question
      if (containsAbusiveLanguage(text) && currentQ && speaker) {
        sessionViolations.current.push({
          kind: "conduct-abuse",
          atMs: Date.now(),
        });
        setTurns((prev) => [
          ...prev,
          { role: "candidate", text, timestampMs: Date.now() },
        ]);
        const chair = getPanelMember("chair");
        const stern = getPanelMember("member-d");
        setSpeaker(chair);
        setStatus(`${chair.name}: conduct warning`);
        setSpeaking(true);
        const reprimand =
          "Candidate, that language is completely unacceptable in this board room. " +
          "Compose yourself. We expect dignity and restraint from an officer. " +
          "I will ask the same question again — answer with respect.";
        speakAsMember(reprimand, chair, () => {
          setSpeaker(stern);
          setSpeaking(true);
          speakAsMember(
            `Again. ${currentQ}`,
            stern,
            () => {
              setSpeaking(false);
              setStatus("Your turn — answer with composure.");
              scheduleTakeYourTime(stern);
            },
          );
        });
        setBusy(false);
        submitLock.current = false;
        return;
      }

      // "Please repeat / be clearer" must NOT advance to a new topic
      if (isMetaQuestionRequest(text) && currentQ && speaker) {
        setTurns((prev) => [
          ...prev,
          { role: "candidate", text, timestampMs: Date.now() },
        ]);
        const clarify = isClarifyRequest(text) && !isRepeatRequest(text);
        const spoken = clarify
          ? clarifyQuestionText(currentQ)
          : `Certainly. The question again. ${currentQ}`;
        setStatus(
          clarify
            ? `${speaker.name} is clarifying…`
            : `${speaker.name} is repeating the question…`,
        );
        setSpeaking(true);
        speakAsMember(spoken, speaker, () => {
          setSpeaking(false);
          setStatus("Your turn — press Answer when ready.");
          scheduleTakeYourTime(speaker);
        });
        // Update displayed question to the clarified wording when clarifying
        if (clarify) {
          setCurrentQ(spoken);
        }
        setBusy(false);
        submitLock.current = false;
        return;
      }

      await submitBoardAnswer(sessionId, text, proctor.violations);
      proctor.clearViolations();
      setTurns((prev) => [
        ...prev,
        { role: "candidate", text, timestampMs: Date.now() },
      ]);
      setCurrentQ(null);
      setIsFollowUp(false);
      if (opts?.fromRamble) {
        setStatus("Panel noted the length — next question.");
      }
      await askNext(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  }

  async function endBoard() {
    stopBoardSpeech();
    clearPaceTimers();
    captions.stop();
    recorder.reset();
    await exitBoardFullscreen();
    setPhase("ended");
    if (sessionId) {
      try {
        const report = await fetchBoardDebrief(
          sessionId,
          turns.map((t) => ({
            role: t.role,
            text: t.text,
            speakerId: t.speakerId,
            speakerName: t.speakerName,
            category: t.category,
            isFollowUp: t.isFollowUp,
          })),
          sessionViolations.current.length
            ? sessionViolations.current
            : proctor.violations,
        );
        setDebrief(report);
      } catch {
        setDebrief(null);
      }
    }
  }

  if (phase === "intake") {
    return (
      <div className="grid gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Board interview
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            DAF intake
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Five distinct panelists — chair, subject member, generalist, quiet
            jumper, and a fixed skeptic. They welcome you first, then deepen;
            they also cross-question vague answers. Optional: upload your UPSC
            application PDF.
          </p>
          {backendOk === false && (
            <div className="mt-3">
              <MetaChip>Board API offline — start backend on :8000</MetaChip>
            </div>
          )}
        </div>
        <DAFIntakeForm onSubmit={startSession} busy={busy} />
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="grid gap-6">
        <Panel className="p-6">
          <h2 className="font-display text-3xl">Session closed</h2>
          <p className="mt-2 text-[var(--muted)]">
            {turns.filter((t) => t.role === "board").length} board questions ·{" "}
            {proctor.violations.length} discipline events
          </p>
        </Panel>

        {debrief ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">
                {debrief.boardReport.title}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {debrief.boardReport.summary}
              </p>
              {debrief.categoryCoverage.length > 0 && (
                <p className="mt-3 font-mono text-[10px] text-[var(--muted)]">
                  {debrief.categoryCoverage.join(" · ")}
                </p>
              )}
              <Section title="Strengths" items={debrief.boardReport.strengths} />
              <Section
                title="To improve"
                items={debrief.boardReport.weaknesses}
              />
              <Section title="Transcript notes" items={debrief.boardReport.notes} />
            </Panel>
            <Panel className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">
                {debrief.disciplineReport.title}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {debrief.disciplineReport.eventCount} event
                {debrief.disciplineReport.eventCount === 1 ? "" : "s"}
              </p>
              <Section
                title="Events"
                items={debrief.disciplineReport.notes}
              />
            </Panel>
          </div>
        ) : (
          <Panel className="p-5 text-sm text-[var(--muted)]">
            Debrief unavailable — ensure the board API is running, then end a
            session again.
          </Panel>
        )}

        <button
          type="button"
          className="w-fit rounded-full border border-[var(--line)] px-5 py-2 text-sm"
          onClick={() => {
            setPhase("intake");
            setSessionId(null);
            setTurns([]);
            setCurrentQ(null);
            setSpeaker(null);
            setDebrief(null);
            proctor.clearViolations();
          }}
        >
          New DAF session
        </button>
      </div>
    );
  }

  return (
    <div
      ref={roomRef}
      data-board-live="1"
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[#07090d] text-[var(--ink)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,168,73,0.12),transparent_55%)]" />
      <header className="relative z-10 flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <MetaChip>board room</MetaChip>
          {profile && <MetaChip>{trackLabel(profile.track)}</MetaChip>}
          {category && <MetaChip>{category}</MetaChip>}
          {isFollowUp && <MetaChip>follow-up</MetaChip>}
          <MetaChip>violations {proctor.violations.length}</MetaChip>
          {!isFs && (
            <button
              type="button"
              className="pointer-events-auto rounded-full border border-red-400/40 px-3 py-1 text-xs text-red-300"
              onClick={() =>
                void requestBoardFullscreen(
                  roomRef.current || document.documentElement,
                )
              }
            >
              Return to fullscreen
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => void endBoard()}
          className="rounded-full border border-[var(--line)] px-4 py-1.5 text-sm text-[var(--muted)]"
        >
          End
        </button>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="flex flex-col gap-4">
          <BoardPanelRoom
            speakingId={speaking ? speaker?.id ?? null : null}
            listening={answering}
          />

          <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel)]/80 p-5 backdrop-blur">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              {speaker
                ? `${speaker.name} · ${speaker.role}${isFollowUp ? " · follow-up" : ""}`
                : "Awaiting panel"}
              {speaking ? " · speaking" : ""}
            </p>
            {speaker?.persona && (
              <p className="mt-1 text-xs text-[var(--muted)]">{speaker.persona}</p>
            )}
            <p className="mt-3 font-display text-2xl leading-snug sm:text-3xl">
              {currentQ || "Panel preparing the next question…"}
            </p>
            {trace?.usedInQuestion && (
              <p className="mt-2 text-sm text-[var(--teal)]">
                Grounded with live affairs tool
                {trace.query ? `: ${trace.query}` : ""}
              </p>
            )}
            {status && (
              <p className="mt-3 text-sm text-[var(--muted)]">{status}</p>
            )}
            {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
            {captions.live && answering && (
              <p className="mt-2 text-sm text-[var(--teal)]">You: {captions.live}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {!answering ? (
              <button
                type="button"
                disabled={busy || !currentQ || speaking}
                onClick={() => void beginAnswer()}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 font-display font-semibold text-[var(--void)] disabled:opacity-40"
              >
                <Mic className="h-4 w-4" /> Answer the panel
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitAnswer()}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--teal)] px-6 font-display font-semibold text-[var(--void)] disabled:opacity-40"
              >
                <Square className="h-4 w-4" /> Stop & submit
              </button>
            )}
            <button
              type="button"
              disabled={busy || speaking}
              onClick={() => {
                if (currentQ && speaker) {
                  setSpeaking(true);
                  setStatus(`${speaker.name} repeating…`);
                  speakAsMember(currentQ, speaker, () => {
                    setSpeaking(false);
                    setStatus("Your turn.");
                    scheduleTakeYourTime(speaker);
                  });
                }
              }}
              className="inline-flex h-12 items-center rounded-full border border-[var(--line)] px-5 text-sm disabled:opacity-40"
            >
              Replay voice
            </button>
          </div>

          <textarea
            value={answerDraft}
            onChange={(e) => setAnswerDraft(e.target.value)}
            rows={2}
            placeholder="Backup: type if mic/STT fails"
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]/50"
          />
        </div>

        <div className="flex flex-col gap-4">
          <ProctorOverlay
            videoRef={proctor.attachVideo}
            status={proctor.status}
            violations={proctor.violations}
            compact
          />
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)]/70 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              Session log
            </p>
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm">
              {turns.slice(-10).map((t, i) => (
                <p key={`${t.timestampMs}-${i}`} className="text-[var(--muted)]">
                  <span className="text-[var(--accent)]">
                    {t.role === "board"
                      ? t.speakerName || "Board"
                      : "You"}
                    {t.isFollowUp ? " (fu)" : ""}:
                  </span>{" "}
                  {t.text.slice(0, 140)}
                  {t.text.length > 140 ? "…" : ""}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)]/50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Panel roles
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-[var(--muted)]">
              {BOARD_PANEL.map((m) => (
                <li key={m.id}>
                  <span style={{ color: m.color }}>{m.name}</span> — {m.persona}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--ink)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
