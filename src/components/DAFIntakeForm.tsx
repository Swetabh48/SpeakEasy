"use client";

import { useEffect, useState } from "react";
import { FileUp } from "lucide-react";
import { Panel } from "@/components/Shell";
import {
  DEGREE_OPTIONS,
  ENGINEERING_BRANCH_OPTIONS,
  INDIAN_STATES,
  INSTITUTION_OPTIONS,
  OPTIONAL_SUBJECT_OPTIONS,
} from "@/lib/dafOptions";
import { loadSavedDaf, saveDaf } from "@/lib/dafStorage";
import { extractPdfText } from "@/lib/pdfText";
import {
  SERVICE_TRACKS,
  type CandidateProfile,
  type ServiceTrack,
} from "@/lib/topics/board";

export function DAFIntakeForm({
  onSubmit,
  busy,
}: {
  onSubmit: (profile: CandidateProfile) => void | Promise<void>;
  busy?: boolean;
}) {
  const [track, setTrack] = useState<ServiceTrack>("upsc-cse");
  const [name, setName] = useState("");
  const [homeState, setHomeState] = useState("Bihar");
  const [degree, setDegree] = useState("");
  const [degreeOther, setDegreeOther] = useState("");
  const [institution, setInstitution] = useState("");
  const [institutionOther, setInstitutionOther] = useState("");
  const [year, setYear] = useState(2022);
  const [optionalSubject, setOptionalSubject] = useState("");
  const [optionalOther, setOptionalOther] = useState("");
  const [engineeringBranch, setEngineeringBranch] = useState("Not applicable");
  const [branchOther, setBranchOther] = useState("");
  const [workExperience, setWorkExperience] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [prefs, setPrefs] = useState("");
  const [dafNotes, setDafNotes] = useState("");
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadSavedDaf();
    if (saved) {
      setTrack(saved.track);
      setName(saved.name);
      setHomeState(saved.homeState);
      const deg = saved.education.degree;
      if ((DEGREE_OPTIONS as readonly string[]).includes(deg)) setDegree(deg);
      else {
        setDegree("Other");
        setDegreeOther(deg);
      }
      const inst = saved.education.institution;
      if ((INSTITUTION_OPTIONS as readonly string[]).includes(inst)) {
        setInstitution(inst);
      } else {
        setInstitution("Other");
        setInstitutionOther(inst);
      }
      setYear(saved.education.year);
      const opt = saved.optionalSubject || "Not applicable";
      if ((OPTIONAL_SUBJECT_OPTIONS as readonly string[]).includes(opt)) {
        setOptionalSubject(opt);
      } else {
        setOptionalSubject("Other");
        setOptionalOther(opt);
      }
      const br = saved.engineeringBranch || "Not applicable";
      if ((ENGINEERING_BRANCH_OPTIONS as readonly string[]).includes(br)) {
        setEngineeringBranch(br);
      } else {
        setEngineeringBranch("Other");
        setBranchOther(br);
      }
      setWorkExperience(saved.workExperience || "");
      setHobbies((saved.hobbies || []).join(", "));
      setPrefs((saved.servicePreferences || []).join(", "));
      setDafNotes(saved.dafUploadNotes || "");
    }
    setHydrated(true);
  }, []);

  async function onPdf(file: File | null) {
    if (!file) return;
    setPdfName(file.name);
    setError(null);
    try {
      const text = await extractPdfText(file);
      if (!text) {
        setError("Could not read text from this PDF. You can still fill the form manually.");
        return;
      }
      setDafNotes(text.slice(0, 8000));
      // Light auto-fill hints from PDF text
      const nameMatch = text.match(
        /(?:name|candidate'?s name)\s*[:\-]?\s*([A-Za-z .]{3,60})/i,
      );
      if (nameMatch?.[1] && !name.trim()) setName(nameMatch[1].trim());
    } catch {
      setError("PDF read failed. Fill the form manually — upload is optional.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const deg = degree === "Other" ? degreeOther.trim() : degree.trim();
    const inst =
      institution === "Other" ? institutionOther.trim() : institution.trim();
    const optRaw =
      optionalSubject === "Other"
        ? optionalOther.trim()
        : optionalSubject.trim();
    const branchRaw =
      engineeringBranch === "Other"
        ? branchOther.trim()
        : engineeringBranch.trim();

    if (
      !name.trim() ||
      !deg ||
      !inst ||
      !homeState ||
      !year ||
      !optRaw ||
      !branchRaw ||
      !workExperience.trim() ||
      !hobbies.trim() ||
      !prefs.trim()
    ) {
      setError("Please complete every starred field before entering the board.");
      return;
    }

    const profile: CandidateProfile = {
      name: name.trim(),
      homeState,
      education: {
        degree: deg,
        institution: inst,
        year: Number(year) || new Date().getFullYear(),
      },
      optionalSubject:
        optRaw === "Not applicable" ? undefined : optRaw,
      engineeringBranch:
        branchRaw === "Not applicable" ? undefined : branchRaw,
      workExperience: workExperience.trim(),
      hobbies: hobbies
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
      servicePreferences: prefs
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
      track,
      dafUploadNotes: dafNotes.trim() || undefined,
    };

    saveDaf(profile);
    try {
      await onSubmit(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
    }
  }

  if (!hydrated) {
    return (
      <Panel className="p-6 text-sm text-[var(--muted)]">Loading saved DAF…</Panel>
    );
  }

  return (
    <Panel className="p-5 sm:p-7">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
            Service track <Req />
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SERVICE_TRACKS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTrack(t.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  track === t.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "border-[var(--line)] text-[var(--muted)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel-2)]/60 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Upload DAF / UPSC application PDF <span className="text-[var(--muted)]">(optional)</span>
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Not compulsory. If you upload, we extract text to assist the board —
            you still confirm the fields below.
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm hover:border-[var(--accent)]/50">
            <FileUp className="h-4 w-4" />
            {pdfName ? pdfName : "Choose PDF"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => void onPdf(e.target.files?.[0] || null)}
            />
          </label>
          {dafNotes && (
            <p className="mt-2 font-mono text-[10px] text-[var(--teal)]">
              PDF text captured ({dafNotes.length} chars) — saved with your DAF
            </p>
          )}
        </div>

        <Field label="Full name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="As on DAF"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Home state" required>
            <select
              value={homeState}
              onChange={(e) => setHomeState(e.target.value)}
              className={inputClass}
              required
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Graduation year" required>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={inputClass}
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Degree" required>
            <select
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select degree</option>
              {DEGREE_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {degree === "Other" && (
              <input
                value={degreeOther}
                onChange={(e) => setDegreeOther(e.target.value)}
                className={`${inputClass} mt-2`}
                placeholder="Type your degree"
                required
              />
            )}
          </Field>
          <Field label="Institution" required>
            <select
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select institution</option>
              {INSTITUTION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {institution === "Other" && (
              <input
                value={institutionOther}
                onChange={(e) => setInstitutionOther(e.target.value)}
                className={`${inputClass} mt-2`}
                placeholder="Type your institution"
                required
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Optional subject (CSE/IFS)" required>
            <select
              value={optionalSubject}
              onChange={(e) => setOptionalSubject(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select optional</option>
              {OPTIONAL_SUBJECT_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {optionalSubject === "Other" && (
              <input
                value={optionalOther}
                onChange={(e) => setOptionalOther(e.target.value)}
                className={`${inputClass} mt-2`}
                placeholder="Type optional subject"
                required
              />
            )}
          </Field>
          <Field label="Engineering branch (IES/PSU)" required>
            <select
              value={engineeringBranch}
              onChange={(e) => setEngineeringBranch(e.target.value)}
              className={inputClass}
              required
            >
              {ENGINEERING_BRANCH_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {engineeringBranch === "Other" && (
              <input
                value={branchOther}
                onChange={(e) => setBranchOther(e.target.value)}
                className={`${inputClass} mt-2`}
                placeholder="Type branch"
                required
              />
            )}
          </Field>
        </div>

        <Field label="Work experience" required>
          <textarea
            value={workExperience}
            onChange={(e) => setWorkExperience(e.target.value)}
            className={inputClass}
            rows={2}
            placeholder="Roles, orgs, duration (write 'None' if fresher)"
            required
          />
        </Field>

        <Field label="Hobbies (comma-separated)" required>
          <input
            value={hobbies}
            onChange={(e) => setHobbies(e.target.value)}
            className={inputClass}
            placeholder="trekking, debate, classical music"
            required
          />
        </Field>

        <Field label="Service preferences (comma-separated)" required>
          <input
            value={prefs}
            onChange={(e) => setPrefs(e.target.value)}
            className={inputClass}
            placeholder="IAS, IPS, NTPC…"
            required
          />
        </Field>

        <p className="text-xs text-[var(--muted)]">
          Your DAF is saved on this device so you do not retype it next time.
        </p>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-[var(--accent)] px-8 font-display font-semibold text-[var(--void)] disabled:opacity-50"
        >
          {busy ? "Starting board…" : "Enter the board room"}
        </button>
      </form>
    </Panel>
  );
}

function Req() {
  return <span className="text-[var(--accent)]"> *</span>;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
        {required ? <Req /> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]/50";
