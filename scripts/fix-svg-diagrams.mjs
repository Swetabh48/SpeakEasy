import { writeFileSync } from "node:fs";

const enc = `<?xml version="1.0" encoding="UTF-8"?>\n`;

const hld = `${enc}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 820" role="img">
  <defs>
    <marker id="a" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#f0c14b"/></marker>
    <marker id="am" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#94a3b8"/></marker>
  </defs>
  <rect width="1400" height="820" rx="12" fill="#0a0a0a"/>
  <text x="70" y="50" fill="#f0c14b" font-family="system-ui,sans-serif" font-size="14" font-weight="700">CLIENTS</text>
  <rect x="40" y="70" width="200" height="70" rx="10" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
  <text x="140" y="100" text-anchor="middle" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="18" font-weight="700">Browser</text>
  <text x="140" y="122" text-anchor="middle" fill="#94a3b8" font-family="ui-monospace,monospace" font-size="12">spkeasy.in</text>
  <rect x="40" y="160" width="200" height="55" rx="10" fill="#334155" stroke="#94a3b8"/>
  <text x="140" y="193" text-anchor="middle" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="15">Practice UI  /</text>
  <rect x="40" y="230" width="200" height="55" rx="10" fill="#334155" stroke="#94a3b8"/>
  <text x="140" y="263" text-anchor="middle" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="15">Board UI  /board</text>
  <rect x="40" y="300" width="200" height="55" rx="10" fill="#334155" stroke="#94a3b8"/>
  <text x="140" y="333" text-anchor="middle" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="15">Profile  /profile</text>
  <rect x="40" y="370" width="200" height="55" rx="10" fill="#334155" stroke="#94a3b8"/>
  <text x="140" y="403" text-anchor="middle" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="15">Engineering</text>
  <path d="M240 105 H320" stroke="#f0c14b" stroke-width="2.5" marker-end="url(#a)"/>
  <path d="M240 257 H320" stroke="#f0c14b" stroke-width="2.5" marker-end="url(#a)"/>
  <rect x="320" y="70" width="130" height="420" rx="14" fill="#7c2d12" stroke="#ea580c" stroke-width="2"/>
  <text x="385" y="250" text-anchor="middle" fill="#ffedd5" font-family="system-ui,sans-serif" font-size="15" font-weight="800" transform="rotate(-90 385 300)">SAME-ORIGIN APIs</text>
  <text x="385" y="430" text-anchor="middle" fill="#fdba74" font-family="ui-monospace,monospace" font-size="11">Next.js / Vercel</text>
  <text x="385" y="450" text-anchor="middle" fill="#fdba74" font-family="ui-monospace,monospace" font-size="10">no auth (v0)</text>
  <text x="520" y="50" fill="#f0c14b" font-family="system-ui,sans-serif" font-size="14" font-weight="700">CORE MODULES</text>
  <rect x="500" y="70" width="280" height="64" rx="10" fill="#bae6fd" stroke="#0284c7" stroke-width="2"/>
  <text x="640" y="98" text-anchor="middle" fill="#0c4a6e" font-family="system-ui,sans-serif" font-size="16" font-weight="700">Evaluate API</text>
  <text x="640" y="118" text-anchor="middle" fill="#0369a1" font-family="ui-monospace,monospace" font-size="12">POST /api/evaluate</text>
  <rect x="500" y="150" width="280" height="64" rx="10" fill="#bae6fd" stroke="#0284c7" stroke-width="2"/>
  <text x="640" y="178" text-anchor="middle" fill="#0c4a6e" font-family="system-ui,sans-serif" font-size="16" font-weight="700">Board Agent API</text>
  <text x="640" y="198" text-anchor="middle" fill="#0369a1" font-family="ui-monospace,monospace" font-size="12">/api/board/* + session Map</text>
  <rect x="500" y="230" width="280" height="64" rx="10" fill="#fef08a" stroke="#ca8a04" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="640" y="258" text-anchor="middle" fill="#713f12" font-family="system-ui,sans-serif" font-size="16" font-weight="700">Transcribe API (optional)</text>
  <text x="640" y="278" text-anchor="middle" fill="#a16207" font-family="ui-monospace,monospace" font-size="12">POST /api/transcribe</text>
  <rect x="500" y="310" width="280" height="64" rx="10" fill="#bae6fd" stroke="#0284c7" stroke-width="2"/>
  <text x="640" y="338" text-anchor="middle" fill="#0c4a6e" font-family="system-ui,sans-serif" font-size="16" font-weight="700">Topic Engine</text>
  <text x="640" y="358" text-anchor="middle" fill="#0369a1" font-family="ui-monospace,monospace" font-size="12">client-side banks + fingerprints</text>
  <rect x="500" y="390" width="280" height="64" rx="10" fill="#bae6fd" stroke="#0284c7" stroke-width="2"/>
  <text x="640" y="418" text-anchor="middle" fill="#0c4a6e" font-family="system-ui,sans-serif" font-size="16" font-weight="700">Whisper WASM + Proctor</text>
  <text x="640" y="438" text-anchor="middle" fill="#0369a1" font-family="ui-monospace,monospace" font-size="12">in-browser STT | MediaPipe</text>
  <path d="M450 105 H500" stroke="#f0c14b" stroke-width="2.5" marker-end="url(#a)"/>
  <path d="M450 182 H500" stroke="#f0c14b" stroke-width="2.5" marker-end="url(#a)"/>
  <path d="M450 262 H500" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#am)"/>
  <text x="900" y="50" fill="#f0c14b" font-family="system-ui,sans-serif" font-size="14" font-weight="700">DATA AND EXTERNAL</text>
  <ellipse cx="980" cy="95" rx="90" ry="22" fill="#86efac" stroke="#16a34a" stroke-width="2"/>
  <rect x="890" y="95" width="180" height="70" fill="#86efac" stroke="#16a34a" stroke-width="2"/>
  <ellipse cx="980" cy="165" rx="90" ry="22" fill="#4ade80" stroke="#16a34a" stroke-width="2"/>
  <text x="980" y="130" text-anchor="middle" fill="#14532d" font-family="system-ui,sans-serif" font-size="15" font-weight="700">localStorage</text>
  <text x="980" y="150" text-anchor="middle" fill="#166534" font-family="ui-monospace,monospace" font-size="11">evals | DAF | history</text>
  <ellipse cx="1220" cy="95" rx="90" ry="22" fill="#fda4af" stroke="#e11d48" stroke-width="2"/>
  <rect x="1130" y="95" width="180" height="70" fill="#fda4af" stroke="#e11d48" stroke-width="2"/>
  <ellipse cx="1220" cy="165" rx="90" ry="22" fill="#fb7185" stroke="#e11d48" stroke-width="2"/>
  <text x="1220" y="125" text-anchor="middle" fill="#881337" font-family="system-ui,sans-serif" font-size="14" font-weight="700">EVALUATOR_URL</text>
  <text x="1220" y="145" text-anchor="middle" fill="#9f1239" font-family="ui-monospace,monospace" font-size="11">optional LLM examiner</text>
  <ellipse cx="1220" cy="230" rx="90" ry="22" fill="#fda4af" stroke="#e11d48" stroke-width="2"/>
  <rect x="1130" y="230" width="180" height="55" fill="#fda4af" stroke="#e11d48" stroke-width="2"/>
  <ellipse cx="1220" cy="285" rx="90" ry="22" fill="#fb7185" stroke="#e11d48" stroke-width="2"/>
  <text x="1220" y="262" text-anchor="middle" fill="#881337" font-family="system-ui,sans-serif" font-size="14" font-weight="700">Cloud Whisper</text>
  <text x="1220" y="280" text-anchor="middle" fill="#9f1239" font-family="ui-monospace,monospace" font-size="11">optional STT</text>
  <rect x="890" y="220" width="180" height="90" rx="12" fill="#c4b5fd" stroke="#7c3aed" stroke-width="2"/>
  <text x="980" y="258" text-anchor="middle" fill="#4c1d95" font-family="system-ui,sans-serif" font-size="15" font-weight="700">Session Map</text>
  <text x="980" y="280" text-anchor="middle" fill="#5b21b6" font-family="ui-monospace,monospace" font-size="11">in-memory board</text>
  <text x="980" y="298" text-anchor="middle" fill="#5b21b6" font-family="ui-monospace,monospace" font-size="11">volatile on serverless</text>
  <path d="M780 102 H890" stroke="#94a3b8" stroke-width="2" marker-end="url(#am)"/>
  <path d="M780 182 H890" stroke="#7c3aed" stroke-width="2.5" marker-end="url(#a)"/>
  <path d="M780 102 C860 60 1000 60 1130 125" stroke="#e11d48" stroke-width="2" stroke-dasharray="6 4" fill="none" marker-end="url(#am)"/>
  <path d="M780 262 C900 262 1000 255 1130 255" stroke="#e11d48" stroke-width="2" stroke-dasharray="6 4" fill="none" marker-end="url(#am)"/>
  <path d="M140 425 V500 H980 V185" stroke="#16a34a" stroke-width="2" stroke-dasharray="5 4" fill="none" marker-end="url(#am)"/>
  <text x="200" y="490" fill="#4ade80" font-family="ui-monospace,monospace" font-size="11">persist on device</text>
  <rect x="500" y="520" width="760" height="250" rx="16" fill="#1c1917" stroke="#ca8a04" stroke-width="2" stroke-dasharray="8 5"/>
  <text x="530" y="555" fill="#fbbf24" font-family="system-ui,sans-serif" font-size="14" font-weight="700">OPTIONAL LOCAL PATH (dev only - never localhost on Vercel)</text>
  <rect x="540" y="580" width="220" height="70" rx="10" fill="#fef08a" stroke="#ca8a04" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="650" y="610" text-anchor="middle" fill="#713f12" font-family="system-ui,sans-serif" font-size="15" font-weight="700">FastAPI :8000</text>
  <text x="650" y="632" text-anchor="middle" fill="#a16207" font-family="ui-monospace,monospace" font-size="12">/board | /eval</text>
  <ellipse cx="900" cy="600" rx="80" ry="18" fill="#86efac" stroke="#16a34a" stroke-width="2"/>
  <rect x="820" y="600" width="160" height="50" fill="#86efac" stroke="#16a34a" stroke-width="2"/>
  <ellipse cx="900" cy="650" rx="80" ry="18" fill="#4ade80" stroke="#16a34a" stroke-width="2"/>
  <text x="900" y="630" text-anchor="middle" fill="#14532d" font-family="system-ui,sans-serif" font-size="14" font-weight="700">SQLite / Postgres</text>
  <ellipse cx="1120" cy="600" rx="80" ry="18" fill="#fda4af" stroke="#e11d48" stroke-width="2"/>
  <rect x="1040" y="600" width="160" height="50" fill="#fda4af" stroke="#e11d48" stroke-width="2"/>
  <ellipse cx="1120" cy="650" rx="80" ry="18" fill="#fb7185" stroke="#e11d48" stroke-width="2"/>
  <text x="1120" y="630" text-anchor="middle" fill="#881337" font-family="system-ui,sans-serif" font-size="14" font-weight="700">Ollama</text>
  <path d="M640 450 V580" stroke="#ca8a04" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#am)"/>
  <text x="660" y="520" fill="#fbbf24" font-family="ui-monospace,monospace" font-size="11">NEXT_PUBLIC_BACKEND_URL</text>
  <path d="M760 615 H820" stroke="#94a3b8" stroke-width="2" marker-end="url(#am)"/>
  <path d="M760 615 H1040" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#am)"/>
  <text x="540" y="720" fill="#a8a29e" font-family="system-ui,sans-serif" font-size="13">Production leaves this path unset. Live site uses Next /api/board only.</text>
  <text x="40" y="800" fill="#64748b" font-family="ui-monospace,monospace" font-size="12">Speakeasy HLD | solid = production | dashed = optional</text>
</svg>
`;

const practice = `${enc}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 420" role="img">
  <rect width="1100" height="420" rx="12" fill="#0a0a0a"/>
  <text x="40" y="40" fill="#f0c14b" font-family="system-ui,sans-serif" font-size="18" font-weight="700">Practice Session Flow</text>
  <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#f0c14b"/></marker></defs>
  <rect x="40" y="80" width="140" height="70" rx="10" fill="#bae6fd" stroke="#0284c7" stroke-width="2"/>
  <text x="110" y="110" text-anchor="middle" fill="#0c4a6e" font-size="14" font-weight="700" font-family="system-ui,sans-serif">Filters</text>
  <text x="110" y="130" text-anchor="middle" fill="#0369a1" font-size="11" font-family="ui-monospace,monospace">mode | field</text>
  <path d="M180 115 H210" stroke="#f0c14b" stroke-width="2" marker-end="url(#ar)"/>
  <rect x="210" y="80" width="140" height="70" rx="10" fill="#bae6fd" stroke="#0284c7" stroke-width="2"/>
  <text x="280" y="110" text-anchor="middle" fill="#0c4a6e" font-size="14" font-weight="700" font-family="system-ui,sans-serif">drawTopic</text>
  <text x="280" y="130" text-anchor="middle" fill="#0369a1" font-size="11" font-family="ui-monospace,monospace">fingerprint</text>
  <path d="M350 115 H380" stroke="#f0c14b" stroke-width="2" marker-end="url(#ar)"/>
  <rect x="380" y="80" width="140" height="70" rx="10" fill="#bae6fd" stroke="#0284c7" stroke-width="2"/>
  <text x="450" y="110" text-anchor="middle" fill="#0c4a6e" font-size="14" font-weight="700" font-family="system-ui,sans-serif">Prep timer</text>
  <text x="450" y="130" text-anchor="middle" fill="#0369a1" font-size="11" font-family="ui-monospace,monospace">client hook</text>
  <path d="M520 115 H550" stroke="#f0c14b" stroke-width="2" marker-end="url(#ar)"/>
  <rect x="550" y="80" width="160" height="70" rx="10" fill="#bae6fd" stroke="#0284c7" stroke-width="2"/>
  <text x="630" y="110" text-anchor="middle" fill="#0c4a6e" font-size="14" font-weight="700" font-family="system-ui,sans-serif">Speak / Write</text>
  <text x="630" y="130" text-anchor="middle" fill="#0369a1" font-size="11" font-family="ui-monospace,monospace">record | type | PDF</text>
  <path d="M630 150 V190" stroke="#f0c14b" stroke-width="2" marker-end="url(#ar)"/>
  <rect x="400" y="200" width="200" height="70" rx="10" fill="#c4b5fd" stroke="#7c3aed" stroke-width="2"/>
  <text x="500" y="230" text-anchor="middle" fill="#4c1d95" font-size="14" font-weight="700" font-family="system-ui,sans-serif">STT merge</text>
  <text x="500" y="250" text-anchor="middle" fill="#5b21b6" font-size="11" font-family="ui-monospace,monospace">Whisper vs captions</text>
  <path d="M600 235 H650" stroke="#f0c14b" stroke-width="2" marker-end="url(#ar)"/>
  <rect x="650" y="200" width="200" height="70" rx="10" fill="#fdba74" stroke="#ea580c" stroke-width="2"/>
  <text x="750" y="230" text-anchor="middle" fill="#7c2d12" font-size="14" font-weight="700" font-family="system-ui,sans-serif">POST /api/evaluate</text>
  <text x="750" y="250" text-anchor="middle" fill="#9a3412" font-size="11" font-family="ui-monospace,monospace">scoring waterfall</text>
  <path d="M850 235 H900" stroke="#f0c14b" stroke-width="2" marker-end="url(#ar)"/>
  <rect x="900" y="200" width="160" height="70" rx="10" fill="#86efac" stroke="#16a34a" stroke-width="2"/>
  <text x="980" y="230" text-anchor="middle" fill="#14532d" font-size="14" font-weight="700" font-family="system-ui,sans-serif">localStorage</text>
  <text x="980" y="250" text-anchor="middle" fill="#166534" font-size="11" font-family="ui-monospace,monospace">profile | history</text>
  <rect x="40" y="310" width="1020" height="80" rx="12" fill="#1c1917" stroke="#44403c"/>
  <text x="60" y="345" fill="#f0c14b" font-size="14" font-weight="700" font-family="system-ui,sans-serif">Evaluate waterfall</text>
  <text x="60" y="370" fill="#d6d3d1" font-size="13" font-family="ui-monospace,monospace">1) EVALUATOR_URL  -&gt;  2) Ollama  -&gt;  3) local-strict grader (always on)   |   empty / short answers -&gt; near-zero</text>
</svg>
`;

writeFileSync("public/developers/speakeasy-hld.svg", hld, "utf8");
writeFileSync("public/developers/practice-flow.svg", practice, "utf8");
console.log("ok");
