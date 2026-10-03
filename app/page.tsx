import Nav from "@/components/Nav";
import NightSky from "@/components/NightSky";
import HeroLightShow from "@/components/Hero";
import Sleeve from "@/components/Sleeve";
import TopArtists from "@/components/TopArtists";
import CopyEmail from "@/components/CopyEmail";
import { about, alsoContributed, gsoc, profile, projects, rig, sessions } from "@/lib/content";

const ext = { target: "_blank", rel: "noopener" } as const;

export default function Home() {
  return (
    <>
      <NightSky />
      <Nav />

      <header className="hero" id="top">
        <HeroLightShow />
        <div className="wrap">
          <div className="kicker ui">
            <b>{profile.role}</b>
            <span>{profile.location}</span>
          </div>
          <h1>
            Divyanshu<br />
            <em>Choudhury</em>
          </h1>
          <p className="lede">
            I&apos;m a computer science student and open-source contributor. I work with Linux, Docker,
            Kubernetes, CI/CD and observability tools, and I&apos;m interested in DevOps, distributed systems and
            backend infrastructure.
          </p>
          <div className="cta">
            <a className="btn primary" href="#work">See the work</a>
            <a className="btn ghost" href="#contact">Get in touch</a>
          </div>
        </div>
      </header>

      <main>
        <section className="block wrap" id="about" aria-labelledby="about-h">
          <div className="head">
            <div><span className="side">Liner notes</span><h2 id="about-h">About me</h2></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="about-photo" src="/me.jpg" alt="Divyanshu Choudhury" width={400} height={400} />
          </div>
          <div className="notes">
            <div className="prose">{about.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</div>
            <dl className="ledger">
              <div><dt>Studying</dt><dd>B.Tech, Computer Science · Gyan Ganga Institute of Technology and Sciences · 2023 to 2027</dd></div>
              <div><dt>CGPA</dt><dd><b>8.0</b></dd></div>
              <div><dt>DSA</dt><dd><b>1736</b> LeetCode contest rating · 555+ problems · 35 rated contests · <a className="soft" href={profile.codolio} {...ext}>all stats on Codolio ↗</a></dd></div>
              <div><dt>Longest streak</dt><dd><b>213</b> days</dd></div>
              <div><dt>Based in</dt><dd>{profile.location}</dd></div>
            </dl>
          </div>
        </section>

        <section className="block wrap" id="work" aria-labelledby="work-h">
          <div className="head">
            <div><span className="side">Side A</span><h2 id="work-h">Things I built</h2></div>
            <p>
              Each one started as a problem I wanted solved properly: data leaking out of AI agents, a neural network
              nobody could see inside, a meeting an AI could actually sit in on.
            </p>
          </div>
          <div className="records">
            {projects.map((p) => (
              <article className="record" key={p.id}>
                <Sleeve id={p.id} cat={p.cat} year={p.year} title={p.title} />
                <div className="info">
                  <span className="no">{p.no}</span>
                  <h3>{p.title}</h3>
                  <p className="hook">{p.hook}</p>
                  <p className="desc">{p.desc}</p>
                  <ul className="stack">{p.stack.map((s) => <li key={s}>{s}</li>)}</ul>
                  <div className="links">
                    {p.links.map((l) => <a key={l.href} href={l.href} {...ext}>{l.label} ↗</a>)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="block wrap" id="experience" aria-labelledby="exp-h">
          <div className="head">
            <div><span className="side">Side B</span><h2 id="exp-h">On tour</h2></div>
            <p>
              A summer inside a scientific computing platform, and code merged into some of the most widely used
              open-source projects there are.
            </p>
          </div>
          <div className="gsoc">
            <div>
              <div className="role ui">{gsoc.role}</div>
              <h3>{gsoc.org}</h3>
              <p>{gsoc.summary}</p>
              <div className="links gsoc-links">
                {gsoc.links.map((l) => <a key={l.href} href={l.href} {...ext}>{l.label} ↗</a>)}
              </div>
            </div>
            <ol>
              {gsoc.milestones.map((m) => (
                <li key={m.title}><div><b>{m.title}</b><span>{m.detail}</span></div></li>
              ))}
            </ol>
          </div>

          <div className="sessions-title">
            <h3>Session work · merged upstream</h3>
            <a href="https://github.com/pulls?q=is%3Apr+author%3ADCchoudhury15+is%3Amerged+-user%3ADCchoudhury15" {...ext}>All 38 merged PRs on GitHub ↗</a>
            <span className="swipe" aria-hidden="true">Swipe →</span>
          </div>
          <div className="sessions">
            {sessions.map((s) => (
              <article className="session" key={s.name}>
                <header><h4>{s.name}</h4><span className="count">{s.total} merged</span></header>
                <span className="lang">{s.lang}</span>
                <ul>
                  {s.prs.map((pr) => (
                    <li key={pr.repo + pr.n}>
                      <a href={`https://github.com/${pr.repo}/pull/${pr.n}`} {...ext}>
                        {pr.title}
                        <small>#{pr.n} · {pr.date}</small>
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="also">Also contributed to {alsoContributed}.</p>
        </section>

        <section className="block wrap" id="rig" aria-labelledby="rig-h">
          <div className="head">
            <div><span className="side">The rig</span><h2 id="rig-h">What I play</h2></div>
            <p>Most at home in systems code: observability, packaging, build systems and the infrastructure underneath.</p>
          </div>
          <div className="rig">
            {rig.map((r) => <div key={r.group}><h3>{r.group}</h3><p>{r.items}</p></div>)}
          </div>
        </section>


        <section className="contact wrap" id="contact" aria-labelledby="contact-h">
          <span className="side">Encore</span>
          <h2 id="contact-h">Let&apos;s work <em>together</em></h2>
          <p>Internships, open-source collaboration, or a good systems problem. My inbox is open.</p>
          <CopyEmail email={profile.email} />
          <div className="socials">
            <a href={profile.github} {...ext}>GitHub</a>
            <a href={profile.linkedin} {...ext}>LinkedIn</a>
            <a href={profile.x} {...ext}>X · {profile.xHandle}</a>
          </div>
        </section>

        <section className="listening wrap" id="listening" aria-labelledby="listening-h">
          <span className="side">Off the record</span>
          <h2 id="listening-h">Who I&apos;m listening to this month</h2>
          <span className="swipe" aria-hidden="true">Swipe →</span>
          <TopArtists />
        </section>

        <p className="sky-note wrap">
          The stars behind this page are the real sky over Jabalpur on the night I was born.
        </p>
      </main>
    </>
  );
}
