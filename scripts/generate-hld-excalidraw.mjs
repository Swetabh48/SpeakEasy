/**
 * Generates Speakeasy HLD as an Excalidraw scene.
 * Run: node scripts/generate-hld-excalidraw.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "public", "developers", "speakeasy-hld.excalidraw");

let seed = 1000;
const nextSeed = () => ++seed;

function base(partial) {
  return {
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    ...partial,
    seed: partial.seed ?? nextSeed(),
    versionNonce: partial.versionNonce ?? nextSeed(),
    version: partial.version ?? 1,
  };
}

function rect(id, x, y, w, h, opts = {}) {
  return base({
    id,
    type: "rectangle",
    x,
    y,
    width: w,
    height: h,
    roundness: { type: 3 },
    backgroundColor: opts.bg ?? "#ffffff",
    strokeColor: opts.stroke ?? "#1e1e1e",
    strokeStyle: opts.dashed ? "dashed" : "solid",
    strokeWidth: opts.strokeWidth ?? 2,
    boundElements: [],
  });
}

function text(id, x, y, raw, opts = {}) {
  const fontSize = opts.fontSize ?? 18;
  const lines = String(raw).split("\n");
  const width = opts.width ?? Math.max(...lines.map((l) => l.length), 4) * (fontSize * 0.58);
  const height = lines.length * fontSize * 1.25;
  return base({
    id,
    type: "text",
    x,
    y,
    width,
    height,
    text: raw,
    originalText: raw,
    fontSize,
    fontFamily: opts.fontFamily ?? 1,
    textAlign: opts.align ?? "left",
    verticalAlign: "top",
    containerId: null,
    autoResize: true,
    lineHeight: 1.25,
    strokeColor: opts.stroke ?? "#1e1e1e",
  });
}

/** Centered label over a box */
function box(id, x, y, w, h, label, opts = {}) {
  const r = rect(id, x, y, w, h, opts);
  const fontSize = opts.fontSize ?? 16;
  const lines = String(label).split("\n");
  const tH = lines.length * fontSize * 1.25;
  const tW = Math.min(w - 12, Math.max(...lines.map((l) => l.length)) * fontSize * 0.58);
  const t = text(`${id}-t`, x + (w - tW) / 2, y + Math.max(8, (h - tH) / 2), label, {
    fontSize,
    align: "center",
    width: tW,
    stroke: opts.labelStroke ?? "#1e1e1e",
  });
  return [r, t];
}

function arrow(id, x, y, points, opts = {}) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return base({
    id,
    type: "arrow",
    x,
    y,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    points,
    startArrowhead: opts.start ?? null,
    endArrowhead: opts.end ?? "arrow",
    startBinding: null,
    endBinding: null,
    lastCommittedPoint: null,
    strokeColor: opts.stroke ?? "#1e1e1e",
    strokeStyle: opts.dashed ? "dashed" : "solid",
    strokeWidth: opts.strokeWidth ?? 2,
  });
}

const el = [];

el.push(text("title", 60, 30, "Speakeasy — High-Level Design", { fontSize: 36 }));
el.push(
  text(
    "subtitle",
    60,
    80,
    "Client-heavy practice studio + same-origin board APIs   |   Production: Vercel · spkeasy.in",
    { fontSize: 16, stroke: "#495057" },
  ),
);

// Legend
el.push(...box("leg1", 60, 125, 150, 36, "Production path", { bg: "#a5d8ff", fontSize: 14 }));
el.push(...box("leg2", 230, 125, 150, 36, "Optional / local", { bg: "#ffec99", dashed: true, fontSize: 14 }));
el.push(...box("leg3", 400, 125, 150, 36, "External service", { bg: "#ffc9c9", fontSize: 14 }));
el.push(...box("leg4", 570, 125, 130, 36, "Data store", { bg: "#b2f2bb", fontSize: 14 }));

// Client frame
el.push(rect("client-frame", 40, 190, 1120, 290, { bg: "#f8f9fa", stroke: "#868e96", strokeWidth: 1 }));
el.push(text("client-h", 60, 205, "CLIENT  ·  Browser", { fontSize: 20 }));

el.push(...box("ui1", 70, 250, 190, 70, "Practice UI\n/", { bg: "#a5d8ff" }));
el.push(...box("ui2", 280, 250, 190, 70, "Board UI\n/board", { bg: "#a5d8ff" }));
el.push(...box("ui3", 490, 250, 160, 70, "Profile\n/profile", { bg: "#a5d8ff" }));
el.push(...box("ui4", 670, 250, 160, 70, "Dev docs\n/developers", { bg: "#a5d8ff" }));
el.push(
  ...box("ls", 860, 250, 270, 200, "localStorage\n\nseen · history · streak\nevals · DAF profile", {
    bg: "#b2f2bb",
    fontSize: 15,
  }),
);

el.push(...box("c1", 70, 360, 150, 70, "Topic engine\nbanks + fingerprint", { bg: "#d0ebff", fontSize: 14 }));
el.push(...box("c2", 240, 360, 160, 70, "MediaRecorder\n+ Web Speech", { bg: "#d0ebff", fontSize: 14 }));
el.push(...box("c3", 420, 360, 160, 70, "Whisper WASM\nin-browser STT", { bg: "#d0ebff", fontSize: 14 }));
el.push(...box("c4", 600, 360, 120, 70, "pdf.js\nessay PDF", { bg: "#d0ebff", fontSize: 14 }));
el.push(...box("c5", 740, 360, 100, 70, "Proctor\ncam / tab", { bg: "#d0ebff", fontSize: 14 }));

// Next frame
el.push(rect("next-frame", 40, 520, 720, 300, { bg: "#e7f5ff", stroke: "#1971c2", strokeWidth: 2 }));
el.push(text("next-h", 60, 535, "APPLICATION  ·  Next.js on Vercel (same-origin APIs)", { fontSize: 18 }));

el.push(...box("api1", 70, 580, 210, 80, "POST /api/evaluate\nscoring waterfall", { bg: "#a5d8ff", fontSize: 15 }));
el.push(
  ...box("api2", 300, 580, 220, 80, "POST /api/transcribe\noptional cloud STT", {
    bg: "#ffec99",
    dashed: true,
    fontSize: 15,
  }),
);
el.push(
  ...box("api3", 70, 690, 450, 90, "POST /api/board/*\nsession · question · answer · debrief\nin-memory session Map + boardAgent", {
    bg: "#a5d8ff",
    fontSize: 14,
  }),
);
el.push(...box("api4", 540, 690, 190, 90, "GET /health\norchestrate\npersonas", { bg: "#a5d8ff", fontSize: 14 }));

// External
el.push(
  rect("ext-frame", 800, 520, 360, 180, {
    bg: "#fff5f5",
    stroke: "#c92a2a",
    strokeWidth: 1,
    dashed: true,
  }),
);
el.push(text("ext-h", 820, 535, "EXTERNAL (optional)", { fontSize: 18 }));
el.push(...box("ext1", 830, 575, 300, 45, "EVALUATOR_URL  (chat-completions API)", { bg: "#ffc9c9", fontSize: 14 }));
el.push(...box("ext2", 830, 635, 300, 45, "Cloud Whisper / audio transcription API", { bg: "#ffc9c9", fontSize: 14 }));

// Local optional
el.push(
  rect("loc-frame", 800, 730, 360, 220, {
    bg: "#fff9db",
    stroke: "#e67700",
    strokeWidth: 1,
    dashed: true,
  }),
);
el.push(text("loc-h", 820, 745, "LOCAL ONLY (optional)", { fontSize: 18 }));
el.push(
  ...box("loc1", 830, 790, 300, 55, "FastAPI :8000   /board · /eval", {
    bg: "#ffec99",
    dashed: true,
    fontSize: 14,
  }),
);
el.push(...box("loc2", 830, 865, 140, 55, "SQLite /\nPostgres", { bg: "#b2f2bb", fontSize: 14 }));
el.push(...box("loc3", 990, 865, 140, 55, "Ollama\nlocal LLM", { bg: "#ffc9c9", fontSize: 14 }));

// Arrows
el.push(arrow("ar1", 165, 320, [[0, 0], [0, 40]]));
el.push(text("ar1t", 175, 325, "generate", { fontSize: 12, stroke: "#495057" }));

el.push(arrow("ar2", 375, 320, [[0, 0], [0, 40]]));
el.push(arrow("ar3", 500, 320, [[0, 0], [-40, 40]]));

el.push(arrow("ar4", 165, 480, [[0, 0], [0, 100]]));
el.push(text("ar4t", 40, 500, "HTTPS\ntranscript", { fontSize: 12, stroke: "#1971c2" }));

el.push(arrow("ar5", 375, 480, [[0, 0], [0, 60], [-80, 210]]));
el.push(text("ar5t", 390, 530, "board Q&A", { fontSize: 12, stroke: "#1971c2" }));

el.push(arrow("ar6", 850, 320, [[0, 0], [-180, 0]], { start: "arrow", end: "arrow", stroke: "#2f9e44" }));
el.push(text("ar6t", 720, 295, "persist", { fontSize: 12, stroke: "#2f9e44" }));

el.push(arrow("ar7", 280, 620, [[0, 0], [550, 0]], { dashed: true, stroke: "#c92a2a" }));
el.push(
  text("ar7t", 360, 595, "waterfall: EVALUATOR → Ollama → local-strict", {
    fontSize: 12,
    stroke: "#c92a2a",
  }),
);

el.push(arrow("ar8", 520, 620, [[0, 0], [310, 40]], { dashed: true, stroke: "#c92a2a" }));

el.push(arrow("ar9", 520, 750, [[0, 0], [310, 70]], { dashed: true, stroke: "#e67700" }));
el.push(
  text("ar9t", 560, 790, "NEXT_PUBLIC_BACKEND_URL\n(never localhost on Vercel)", {
    fontSize: 12,
    stroke: "#e67700",
  }),
);

el.push(arrow("ar10", 980, 845, [[0, 0], [-70, 20]], { dashed: true }));
el.push(arrow("ar11", 980, 845, [[0, 0], [70, 20]], { dashed: true }));

el.push(
  text(
    "notes",
    40,
    990,
    [
      "Design notes",
      "1. Topic generation and Whisper STT run in the browser (cost + privacy).",
      "2. Board defaults to same-origin /api/board so the live site works on any PC.",
      "3. Evaluation waterfall always ends at a local-strict grader if remote models are unavailable.",
      "4. Progress is device-local. No user accounts in v0.",
      "5. FastAPI + Ollama enrich local development; production leaves NEXT_PUBLIC_BACKEND_URL unset.",
    ].join("\n"),
    { fontSize: 15, stroke: "#343a40" },
  ),
);

const scene = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: el,
  appState: {
    gridSize: null,
    viewBackgroundColor: "#ffffff",
  },
  files: {},
};

writeFileSync(out, JSON.stringify(scene, null, 2));
console.log("Wrote", out);
console.log("Elements:", el.length);
