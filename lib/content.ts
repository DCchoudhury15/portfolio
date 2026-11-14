// Everything the site says lives here, so updating the portfolio never means touching layout code.

export const profile = {
  name: "Divyanshu Choudhury",
  role: "Systems & DevOps engineer",
  location: "Jabalpur, India",
  locationMap: "https://www.google.com/maps/place/Jabalpur,+Madhya+Pradesh,+India",
  email: "divyanshuchoudhury51@gmail.com",
  email2: "divyanshuchoudhury3@gmail.com",
  github: "https://github.com/DCchoudhury15",
  gitlab: "https://gitlab.com/divyanshuchoudhury51",
  linkedin: "https://www.linkedin.com/in/divyanshu-choudhury",
  x: "https://x.com/Divyanscpu15",
  instagram: "https://www.instagram.com/ch.divyanshu/",
  spotify: "https://open.spotify.com/user/31xuzvnbhcvlh6ratn7t4dbb6yka",
  // A Blend invite link from the Spotify app (Create Blend > Invite > Copy link). The button stays hidden while empty.
  spotifyBlend: "https://open.spotify.com/blend/taste-match/af79d88e9b4597a4?si=DnocdealSFa8h5Ig-ZKp2Q&fallback=getapphere",
  discord: "dj_choudhury",
  codolio: "https://codolio.com/profile/HSTFfsyv",
};

export type Project = {
  id: string;
  cat: string;
  year: string;
  no: string;
  title: string;
  hook: string;
  desc: string;
  stack: string[];
  links: { label: string; href: string }[];
};

export const projects: Project[] = [
  {
    id: "taintward",
    cat: "DC-001",
    year: "2026",
    no: "01 · flagship",
    title: "Taintward",
    hook: "Lets AI agents use customer data without sending it to the LLM.",
    desc: "Taintward tracks sensitive data like names, SSNs and API keys through every tool call using OpenTelemetry. The LLM only sees placeholders like <PERSON_1>, and real values are tokenized or masked before they reach APIs or logs. It works as a Python SDK, an MCP gateway or an OpenTelemetry Collector policy.",
    stack: ["Python", "Go", "OpenTelemetry", "Rego", "MCP", "Presidio", "Kubernetes"],
    links: [
      { label: "Live site", href: "https://taintward.vercel.app" },
      { label: "Source", href: "https://github.com/DCchoudhury15/Taintward" },
      { label: "The AgentRaft paper", href: "https://arxiv.org/abs/2603.07557" },
    ],
  },
  {
    id: "isowatch",
    cat: "DC-002",
    year: "2026",
    no: "02",
    title: "IsoWatch",
    hook: "Catches the writes your database silently lost.",
    desc: "In PostgreSQL, two requests can overwrite each other with no error. IsoWatch reads each row's version (xmin) on every read and write, builds a dependency graph inside an OpenTelemetry Collector, and marks the trace that lost the write with the SQL and a fix.",
    stack: ["Go", "PostgreSQL 18", "OpenTelemetry Collector", "pgx", "Jaeger"],
    links: [
      { label: "Live site", href: "https://isowatch.vercel.app" },
      { label: "Source", href: "https://github.com/DCchoudhury15/isowatch" },
    ],
  },
  {
    id: "reprobot",
    cat: "DC-003",
    year: "2026",
    no: "03",
    title: "Reprobot",
    hook: "Checks security reports by running them.",
    desc: "A reporter sends a small repro.yaml with a commit and a proof of concept. Reprobot builds that commit with AddressSanitizer, runs the proof of concept in a sandbox with no network, and labels the report as reproduced, not reproduced or flaky.",
    stack: ["Go", "Docker", "AddressSanitizer", "PostgreSQL", "pgx"],
    links: [
      { label: "Live site", href: "https://reprobot-two.vercel.app" },
      { label: "Source", href: "https://github.com/DCchoudhury15/reprobot" },
    ],
  },
  {
    id: "audio",
    cat: "DC-004",
    year: "2025",
    no: "04",
    title: "Audio Visualizer",
    hook: "See how a neural network hears.",
    desc: "A ResNet-style CNN sorts sounds into 50 categories. It runs on a GPU on Modal, and the Next.js site shows the waveform, the spectrogram and what each layer picked up.",
    stack: ["PyTorch", "torchaudio", "Modal", "Next.js", "TypeScript"],
    links: [
      { label: "Live demo", href: "https://audiovisualizer-liard.vercel.app" },
      { label: "Source", href: "https://github.com/DCchoudhury15/audiovisualizer" },
    ],
  },
  {
    id: "resumez",
    cat: "DC-005",
    year: "2025",
    no: "05",
    title: "Resumez",
    hook: "Resumes, written a little like code.",
    desc: "A resume builder for developers. Write with a live preview, pick a template, and show projects with code snippets.",
    stack: ["JavaScript", "Full-stack web"],
    links: [
      { label: "Live demo", href: "https://resumez-zeta.vercel.app" },
      { label: "Source", href: "https://github.com/DCchoudhury15/resumez" },
    ],
  },
];

export const gsoc = {
  role: "Contributor · Google Summer of Code 2026",
  org: "INCF / EBRAINS",
  summary:
    "EBRAINS is a European research infrastructure for brain science. Its software distribution is built with Spack. My project carves smaller, reusable subsets out of it and makes them build against EESSI's prebuilt scientific software stack instead of compiling everything from scratch.",
  links: [
    { label: "GSoC project page", href: "https://summerofcode.withgoogle.com/programs/2026/projects/XV3TCMEB" },
    { label: "My work on EBRAINS GitLab", href: "https://gitlab.ebrains.eu/divyanshu15" },
  ],
  milestones: [
    { title: "Subset generator", detail: "Generates a self-contained Spack environment from any slice of the distribution." },
    { title: "Reusing what's already built", detail: "Pins a subset's dependencies to existing build hashes so packages are reused, not rebuilt." },
    { title: "NEST on EESSI's OpenMPI", detail: "The NEST simulator builds and links against EESSI's OpenMPI as an external package." },
    { title: "Spack 1.2", detail: "arbor, NEST and NEURON all install on Spack 1.2 against EESSI externals." },
  ],
};

export type Session = {
  name: string;
  lang: string;
  total: number;
  prs: { repo: string; n: number; commit?: string; title: string; date: string }[];
};

// Merged pull requests, verified against the GitHub API. The live counts and any newer PRs are
// filled in by lib/contributions.ts.
export const sessions: Session[] = [
  { name: "CPython", lang: "C · Python", total: 1, prs: [{ repo: "python/cpython", n: 143426, commit: "5f57f6970bdea45cc2b192d612bfd8199f51491e", title: "Fix free-threaded build detection in the sampling profiler", date: "Jan 2026" }] },
  {
    name: "OpenTelemetry C++", lang: "C++", total: 2,
    prs: [
      { repo: "open-telemetry/opentelemetry-cpp", n: 3966, commit: "62354e09b4ca7fd22775804bc6aac78dc8cf108b", title: "File configuration: composable samplers", date: "Apr 2026" },
      { repo: "open-telemetry/opentelemetry-cpp", n: 4186, commit: "43b656de87e5534c05bf202bf1a843ba5ba24d34", title: "Honor Retry-After when retrying OTLP/HTTP exports", date: "Aug 2026" },
    ],
  },
  {
    name: "OTel Ecosystem Explorer", lang: "TypeScript", total: 5,
    prs: [
      { repo: "open-telemetry/opentelemetry-ecosystem-explorer", n: 422, commit: "d0b32e53431494896468504f893b8c79fb024eb3", title: "Global Java agent config explorer with a declarative toggle", date: "May 2026" },
      { repo: "open-telemetry/opentelemetry-ecosystem-explorer", n: 399, commit: "ad8d1d4d960143c825b7e2b2122ad4f06bd1127d", title: "Revamped collector stability tab and distribution availability", date: "Jun 2026" },
    ],
  },
  {
    name: "Jaeger", lang: "TypeScript · Helm", total: 2,
    prs: [
      { repo: "jaegertracing/jaeger-ui", n: 3259, commit: "0dbd3b1656d22ed3e120d7ba2a589151dfc11bef", title: "A visual cue for synthetic OpenTelemetry attributes", date: "Jan 2026" },
      { repo: "jaegertracing/helm-charts", n: 713, commit: "ff333174ee38890f87c242ccfc798f74085c1b07", title: "Fix broken template references in es-maintenance and rollover", date: "Jan 2026" },
    ],
  },
  {
    name: "conda / rattler", lang: "Rust", total: 4,
    prs: [
      { repo: "conda/rattler", n: 1968, commit: "68ab94b08fa10f8d3524433b44f4aa8bb8b84144", title: "Support track_features in match-spec brackets", date: "Jan 2026" },
      { repo: "conda/rattler", n: 1899, commit: "6d1c410e5feecd18d174dd7c7c8ff5acdbb98bc6", title: "A dedicated error type for write_repodata", date: "Jan 2026" },
    ],
  },
  {
    name: "sktime", lang: "Python", total: 4,
    prs: [
      { repo: "sktime/sktime", n: 9234, commit: "41dcea8fc4d2b64e9adbbc3871959d94baa3c731", title: "Stop Prophet crashing on stan_backend", date: "Apr 2026" },
      { repo: "sktime/sktime", n: 9200, commit: "b5744410ca5d4b2bf4151dbe0f6201a530cd7d2c", title: "ColumnwiseTransformer sklearn support", date: "Jan 2026" },
    ],
  },
  {
    name: "OpenKruise Agents", lang: "Go · Kubernetes", total: 2,
    prs: [
      { repo: "openkruise/agents", n: 65, commit: "cadea0b7c06460703b103a5cb7adac92ee096df8", title: "Metrics for sandbox creation latency and success rate", date: "Jan 2026" },
      { repo: "openkruise/agents", n: 61, commit: "c08e692d2f83618f1f7025ab7a3cba803cb4b1ff", title: "An enable-pprof flag for the sandbox manager", date: "Jan 2026" },
    ],
  },
];

export const alsoContributed = "kcl-lang, Knative, Kuadrant, PipeCD, skrub, skore and pgmpy";

export const rig = [
  { group: "Languages", items: "Go, C++, Python, TypeScript, SQL, Bash" },
  { group: "Observability", items: "OpenTelemetry, Jaeger, Prometheus, SigNoz" },
  { group: "Infrastructure", items: "Docker, Kubernetes, Helm" },
  { group: "Build & HPC", items: "Spack, EESSI, conda" },
  { group: "Machine learning", items: "PyTorch, torchaudio" },
  { group: "Web", items: "Next.js, React, tRPC, React Query, Tailwind" },
];

export const about = [
  "I'm a final-year computer science student at Gyan Ganga Institute of Technology and Sciences in Jabalpur. Most of my time outside classes goes into open source, and I've had pull requests merged into CPython, OpenTelemetry, Jaeger, conda and a few other projects.",
  "This year I took part in Google Summer of Code with INCF, working on the build setup for the EBRAINS software distribution. A lot of it was getting Spack and EESSI to work together, which taught me a lot about compilers, MPI and CI pipelines.",
  "I'm most interested in DevOps, distributed systems and backend infrastructure. When I'm not working on those, I'm usually doing competitive programming or building side projects like Taintward.",
]

export type Artist = { name: string; url: string; art: string | null };

// Shown until the live Spotify list loads, and whenever Spotify is unreachable.
export const topArtistsFallback: Artist[] = [
  { name: "The Doors", url: "https://open.spotify.com/artist/22WZ7M8sxp5THdruNY3gXt", art: "https://i.scdn.co/image/ab67616100005174440959e022afc20e819050bd" },
  { name: "Led Zeppelin", url: "https://open.spotify.com/artist/36QJpDe2go2KgaRleHCDTp", art: "https://i.scdn.co/image/207803ce008388d3427a685254f9de6a8f61dc2e" },
  { name: "Pink Floyd", url: "https://open.spotify.com/artist/0k17h0D3J5VfsdmQ1iZtE9", art: "https://i.scdn.co/image/ab676161000051743c9e8c67b087ba0cb5923b78" },
  { name: "The Rolling Stones", url: "https://open.spotify.com/artist/22bE4uQ6baNwSHPVcDxLCe", art: "https://i.scdn.co/image/ab676161000051742b72b000ac948eba03bb3afe" },
  { name: "Creedence Clearwater Revival", url: "https://open.spotify.com/artist/3IYUhFvPQItj6xySrBmZkd", art: "https://i.scdn.co/image/ab67616100005174d2e2b04b7ba5d60b72f54506" },
];
