// Everything the site says lives here, so updating the portfolio never means touching layout code.

export const profile = {
  name: "Divyanshu Choudhury",
  role: "Systems & DevOps engineer",
  location: "Jabalpur, India",
  email: "divyanshuchoudhury51@gmail.com",
  github: "https://github.com/DCchoudhury15",
  linkedin: "https://www.linkedin.com/in/divyanshu-choudhury",
  x: "https://x.com/Divyanscpu15",
  instagram: "https://www.instagram.com/ch.divyanshu/",
  spotify: "https://open.spotify.com/user/31xuzvnbhcvlh6ratn7t4dbb6yka",
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
    id: "agentward",
    cat: "DC-001",
    year: "2026",
    no: "01 · flagship",
    title: "AgentWard",
    hook: "A GPS tracker for sensitive data inside AI agents.",
    desc: "AI agents pass data through tools, LLMs and external APIs, and an API key or a customer's address can slip out anywhere along that chain. The AgentRaft paper found this in 57% of the call chains it analysed, but only offline. AgentWard enforces the same formal model live: it detects sensitive fields, carries taint along OpenTelemetry baggage and span links, applies a Rego policy in a sidecar collector, redacts before anything leaves, and records lineage in SigNoz. No LLM sits in the hot path.",
    stack: ["Python", "Go", "OpenTelemetry", "Rego", "Presidio", "SigNoz"],
    links: [
      { label: "Source", href: "https://github.com/DCchoudhury15/agentward" },
      { label: "The AgentRaft paper", href: "https://arxiv.org/abs/2603.07557" },
    ],
  },
  {
    id: "audio",
    cat: "DC-002",
    year: "2025",
    no: "02",
    title: "Audio Visualizer",
    hook: "See how a neural network hears.",
    desc: "A ResNet-style CNN classifies sounds into the 50 environmental categories of ESC-50, then shows its working: the mel spectrogram it was given, the feature maps of every convolutional layer, and the raw waveform. Inference runs on an A10G GPU on Modal, behind a Next.js front end.",
    stack: ["PyTorch", "torchaudio", "Modal", "Next.js", "TypeScript"],
    links: [{ label: "Source", href: "https://github.com/DCchoudhury15/audiovisualizer" }],
  },
  {
    id: "chatai",
    cat: "DC-003",
    year: "2025",
    no: "03",
    title: "Chat-AI",
    hook: "Video meetings with AI agents you design.",
    desc: "Create agents with their own instructions and bring them into live video calls. Built on Stream's video SDK and OpenAI's realtime API, with tRPC and React Query, Drizzle on Neon Postgres, Better Auth, and Inngest for background work after a call.",
    stack: ["Next.js", "tRPC", "Stream Video", "OpenAI Realtime", "Drizzle", "Inngest"],
    links: [{ label: "Source", href: "https://github.com/DCchoudhury15/chat-ai" }],
  },
  {
    id: "resumez",
    cat: "DC-004",
    year: "2025",
    no: "04",
    title: "Resumez",
    hook: "Resumes, written a little like code.",
    desc: "A full-stack resume builder for developers: write and customise with live preview, choose from several templates, and show projects with code snippets alongside the usual sections.",
    stack: ["JavaScript", "Full-stack web"],
    links: [
      { label: "Live demo", href: "https://resumez-mu.vercel.app" },
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
  prs: { repo: string; n: number; title: string; date: string }[];
};

// Merged pull requests, verified against the GitHub API.
export const sessions: Session[] = [
  { name: "CPython", lang: "C · Python", total: 1, prs: [{ repo: "python/cpython", n: 143426, title: "Fix free-threaded build detection in the sampling profiler", date: "Jan 2026" }] },
  {
    name: "OpenTelemetry C++", lang: "C++", total: 2,
    prs: [
      { repo: "open-telemetry/opentelemetry-cpp", n: 3966, title: "File configuration: composable samplers", date: "Apr 2026" },
      { repo: "open-telemetry/opentelemetry-cpp", n: 4186, title: "Honor Retry-After when retrying OTLP/HTTP exports", date: "Aug 2026" },
    ],
  },
  {
    name: "OTel Ecosystem Explorer", lang: "TypeScript", total: 5,
    prs: [
      { repo: "open-telemetry/opentelemetry-ecosystem-explorer", n: 422, title: "Global Java agent config explorer with a declarative toggle", date: "May 2026" },
      { repo: "open-telemetry/opentelemetry-ecosystem-explorer", n: 399, title: "Revamped collector stability tab and distribution availability", date: "Jun 2026" },
    ],
  },
  {
    name: "Jaeger", lang: "TypeScript · Helm", total: 2,
    prs: [
      { repo: "jaegertracing/jaeger-ui", n: 3259, title: "A visual cue for synthetic OpenTelemetry attributes", date: "Jan 2026" },
      { repo: "jaegertracing/helm-charts", n: 713, title: "Fix broken template references in es-maintenance and rollover", date: "Jan 2026" },
    ],
  },
  {
    name: "conda / rattler", lang: "Rust", total: 4,
    prs: [
      { repo: "conda/rattler", n: 1968, title: "Support track_features in match-spec brackets", date: "Jan 2026" },
      { repo: "conda/rattler", n: 1899, title: "A dedicated error type for write_repodata", date: "Jan 2026" },
    ],
  },
  {
    name: "sktime", lang: "Python", total: 4,
    prs: [
      { repo: "sktime/sktime", n: 9234, title: "Stop Prophet crashing on stan_backend", date: "Apr 2026" },
      { repo: "sktime/sktime", n: 9200, title: "ColumnwiseTransformer sklearn support", date: "Jan 2026" },
    ],
  },
  {
    name: "OpenKruise Agents", lang: "Go · Kubernetes", total: 2,
    prs: [
      { repo: "openkruise/agents", n: 65, title: "Metrics for sandbox creation latency and success rate", date: "Jan 2026" },
      { repo: "openkruise/agents", n: 61, title: "An enable-pprof flag for the sandbox manager", date: "Jan 2026" },
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
  "I'm most interested in DevOps, distributed systems and backend infrastructure. When I'm not working on those, I'm usually doing competitive programming or building side projects like AgentWard.",
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
