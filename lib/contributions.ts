// Server-only: my merged open-source pull requests, read live from the GitHub API so the
// contributions section keeps itself up to date. The page rebuilds at most once an hour.
//
// The cards in content.ts are hand-written (names, languages, short titles, chosen PRs). Live data
// fills in around them: every card's count comes from GitHub, a PR merged after REVIEWED goes to
// the top of its project's card, and a project that is not on the page yet gets a card of its own.

import "server-only";
import { alsoContributed, sessions as written, type Session } from "@/lib/content";

const USER = "DCchoudhury15";
// The day the hand-written cards were last checked against GitHub, and the total on that day.
const REVIEWED = "2026-11-04T00:00:00Z";
const REVIEWED_TOTAL = 38;
const PER_CARD = 2;
const HOUR = 3600;

type Pull = { repo: string; n: number; title: string; merged: string };

const headers = (): HeadersInit => ({
  Accept: "application/vnd.github+json",
  "User-Agent": "portfolio-contributions",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

async function github<T>(path: string, revalidate = HOUR): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, { headers: headers(), next: { revalidate } });
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

// Every merged pull request I opened on someone else's repository (the same search the profile README uses).
async function mergedUpstream(): Promise<{ total: number; pulls: Pull[] }> {
  const q = encodeURIComponent(`type:pr author:${USER} is:merged -user:${USER}`);
  type Page = { total_count: number; items: { repository_url: string; number: number; title: string; pull_request: { merged_at: string } }[] };
  const pulls: Pull[] = [];
  let total = 0;
  for (let page = 1; page <= 10; page++) {
    const data = await github<Page>(`/search/issues?q=${q}&per_page=100&page=${page}`);
    total = data.total_count;
    for (const it of data.items) {
      pulls.push({ repo: it.repository_url.replace(/^.*\/repos\//, ""), n: it.number, title: it.title, merged: it.pull_request.merged_at });
    }
    if (data.items.length < 100) break;
  }
  return { total, pulls: pulls.sort((a, b) => b.merged.localeCompare(a.merged)) };
}

// "feat(otel): add ollama spans (#12)" -> "Add ollama spans"
const tidy = (title: string) => {
  const t = title.replace(/^(feat|fix|chore|docs|refactor|perf|tests?|build|ci|style|revert)(\([^)]*\))?!?:\s*/i, "").replace(/\s*\(#\d+\)\s*$/, "").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const month = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const card = (p: Pull) => ({ repo: p.repo, n: p.n, title: tidy(p.title), date: month(p.merged) });

// "open-telemetry/opentelemetry-ebpf-instrumentation" -> "OTel eBPF Instrumentation"
const WORDS: Record<string, string> = { ebpf: "eBPF", ui: "UI", api: "API", sdk: "SDK", cli: "CLI", js: "JS", cpp: "C++", io: "io", k8s: "K8s", mcp: "MCP" };
const projectName = (repo: string) => {
  const words = repo.split("/")[1].split(/[-_]/);
  return words
    .map((w, i) => (w.toLowerCase() === "opentelemetry" ? (words.length > 1 && i === 0 ? "OTel" : "OpenTelemetry") : WORDS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
};

// The repository's two main languages, like "C · Go". Languages hardly change, so this is checked once a day.
async function languages(repo: string) {
  try {
    const bytes = await github<Record<string, number>>(`/repos/${repo}/languages`, 24 * HOUR);
    return Object.entries(bytes).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l]) => l).join(" · ");
  } catch {
    return "";
  }
}

// "Also contributed to ..." lists organisations without a card; one drops out once it gets a card.
const ALSO_ORGS: Record<string, string> = { "kcl-lang": "kcl-lang", Knative: "knative", Kuadrant: "Kuadrant", PipeCD: "pipe-cd", skrub: "skrub-data", skore: "probabl-ai", pgmpy: "pgmpy" };
const listOf = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "");

export type Contributions = { sessions: Session[]; total: number; also: string };

const asWritten: Contributions = { sessions: written, total: REVIEWED_TOTAL, also: alsoContributed };

export async function contributions(): Promise<Contributions> {
  let live: Awaited<ReturnType<typeof mergedUpstream>>;
  try {
    live = await mergedUpstream();
  } catch (err) {
    // While building or in development, fall back to the hand-written cards so the site always
    // builds. On the live site, throwing keeps the last good page instead of going back to them.
    if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "development") return asWritten;
    throw err;
  }
  const isNew = (p: Pull) => p.merged > REVIEWED;
  const covered = new Set(written.flatMap((s) => s.prs.map((p) => p.repo)));

  const updated = written.map((s) => {
    const repos = new Set(s.prs.map((p) => p.repo));
    const mine = live.pulls.filter((p) => repos.has(p.repo));
    const shown = new Set(s.prs.map((p) => `${p.repo}#${p.n}`));
    const fresh = mine.filter((p) => isNew(p) && !shown.has(`${p.repo}#${p.n}`)).map(card);
    return { ...s, total: Math.max(s.total, mine.length), prs: [...fresh, ...s.prs].slice(0, Math.max(PER_CARD, s.prs.length)) };
  });

  // Projects with a new merged PR and no card yet: newest first, ahead of the others.
  const newRepos = [...new Set(live.pulls.filter((p) => isNew(p) && !covered.has(p.repo)).map((p) => p.repo))];
  const added = await Promise.all(
    newRepos.map(async (repo): Promise<Session> => {
      const mine = live.pulls.filter((p) => p.repo === repo);
      return { name: projectName(repo), lang: await languages(repo), total: mine.length, prs: mine.slice(0, PER_CARD).map(card) };
    }),
  );

  const carded = new Set([...covered, ...newRepos].map((r) => r.split("/")[0].toLowerCase()));
  const also = listOf(Object.keys(ALSO_ORGS).filter((name) => !carded.has(ALSO_ORGS[name].toLowerCase())));

  return { sessions: [...added, ...updated], total: Math.max(live.total, REVIEWED_TOTAL), also };
}
