import { useNavigate } from "react-router-dom";
import "../styles/Intro.css";
import { useState } from "react";
import ParticleBackground from "../components/ParticleBackground";
export default function Intro() {
  const nav = useNavigate();
  const [activeIdx, setActiveIdx] = useState(null);

  // 카드에서 사용할 데이터 (배경 이미지 + 설명 포함)
  // Intro.jsx 안의 useCases를 이걸로 교체
  const useCases = [
    {
      icon: "🎓",
      title: "Used as an educational visualized tool.",
      desc: "Perfect for classrooms and self-study: type equations, see them come alive in 3D, and manipulate parameters in real time. Turn abstract symbols into concrete intuition, then capture clean visuals for assignments and presentations. It also supports step-by-step demonstrations and live Q&A moments during lectures.",
      img: "/UseCases1.png",
      pos: "center 50%",
    },
    {
      icon: "🧪",
      title: "Simulation of thesis/research ideas.",
      desc: "Prototype research ideas quickly by iterating on formulas, constraints, and initial conditions in one place. Run lightweight parameter sweeps, compare scenarios side-by-side, and share reproducible, visual experiment setups with your lab or advisor. Logs and snapshots help you document changes as you refine your hypothesis.",
      img: "/UseCases2.png",
      pos: "center 40%",
    },
    {
      icon: "🧮",
      title: "Visual exploration of math problems.",
      desc: "Explore calculus, linear algebra, and geometry visually to build real problem-solving intuition. Trace roots and extrema, inspect curvature, and see how small parameter shifts ripple through a system before committing to formal proofs. Guided overlays and annotations help connect each visual insight back to theory.",
      img: "/UseCases3.png",
      pos: "center 50%",
    },
    {
      icon: "📝",
      title: "Creating interactive math notes.",
      desc: "Author living notes where graphs respond to input instead of staying as static screenshots. Combine text, equations, and interactive plots so readers can tweak parameters and learn immediately. Great for flipped classrooms and peer sharing, with export/embed options to reuse across courses and tutorials.",
      img: "/UseCases4.png",
      pos: "center 35%",
    },
  ];

  return (
    <div className="intro-root">
      <ParticleBackground density={0.00012} accentRatio={0.09} />
      {/* Header */}
      <header className="intro-header">
        <div className="brand">
          <img className="brand-logo" src="/Logo.png" alt="GraphMind logo" />
          <div className="brand-text">
            <div className="brand-name">GraphMind</div>
            <div className="brand-sub">Math. Graph. AI</div>
          </div>
        </div>
        <button className="ghost">Login</button>
      </header>

      {/* Hero */}
      <main className="intro-hero">
        <div className="intro-container">
          <div className="intro-hero-text">
            <h1 className="hero-title">
              <span className="accent">Think</span> in Math.
              <br />
              Visualize in <span className="accent">3D</span>.
            </h1>
            <p className="hero-sub">
              <span className="accent-strong">
                All ideas begin with formulas.
              </span>
              <br />
              GraphMind is an all-in-one interface that integrates formula
              input, graph generation, intuitive editing, and AI interpretation.
              Realize your mathematical imagination in{" "}
              <span className="accent-strong">real-time 3D</span>.
            </p>
            <button className="cta" onClick={() => nav("/studio")}>
              Start
            </button>
          </div>

          <div className="hero-image-wrapper">
            <img
              className="hero-image"
              src="/Logo.png"
              alt="3D graph example"
            />
          </div>
        </div>

        {/* Features #01 */}
        <section className="features">
          <span className="features-flow">[feature Section - #01]</span>
          <h2>Key Features</h2>
          <img
            className="feature-image"
            src="/feature01.png"
            alt="Feature illustration"
          />
        </section>

        {/* Features #02 */}
        <section className="features">
          <span className="features-flow">[feature Section - #02]</span>
          <h2>Use Cases</h2>

          <div className="UseCases-grid">
            {useCases.map((c, idx) => (
              <button
                key={idx}
                type="button"
                className={`UseCases-card ${activeIdx === idx ? "active" : ""}`}
                onClick={() => setActiveIdx(idx)}
                aria-label={c.title}
              >
                {/* 배경 전용 레이어 (이미지 + 포지션) */}
                <span
                  className="UseCases-bg"
                  style={{
                    backgroundImage: `url(${c.img})`,
                    backgroundPosition: c.pos || "center",
                  }}
                  aria-hidden="true"
                />
                {/* 텍스트 레이어 */}
                <div className="UseCases-content">
                  <div className="icon" aria-hidden="true">
                    {c.icon}
                  </div>
                  <div className="UseCases-texts">
                    <span className="UseCases-title">{c.title}</span>
                    <p className="UseCases-desc">{c.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
        </section>

        {/* Features #03 — Use Cases */}
        <section className="features">
          <span className="features-flow">[feature Section - #03]</span>
          <h2>From Formula to Space:</h2>
          <h2>A New Language of Mathematics</h2>
          <h4 style={{ color: "#BCBCBC" }}>
            A tool that Visualizes creative thinking
            <br />
            and empowers learning with clairity.
          </h4>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="icon">f(x)</div>
              <div className="f-title">Equation Input → 3D Graph</div>
              <p style={{ fontSize: "12px", color: "#DCE1F5" }}>
                Instantly turn equations into interactive curves in 3D space.
              </p>
            </div>
            <div className="feature-card">
              <div className="icon">◬</div>
              <div className="f-title">
                Your ideas deserve to be visualized.
              </div>
              <p style={{ fontSize: "12px", color: "#DCE1F5" }}>
                GraphMind lets your mathematical thinking take shape—literally.
                From formula to 3D, bring your thoughts into the world.
              </p>
            </div>
            <div className="feature-card">
              <div className="icon">⇄</div>
              <div className="f-title">
                Designed for learning, built for lasting insightc
              </div>
              <p style={{ fontSize: "12px", color: "#DCE1F5" }}>
                Whether you’re studying for a test or exploring a thesis,
                GraphMind helps you see the big picture—and save it for later.
              </p>
            </div>
            <div className="feature-card">
              <div className="icon">✨</div>
              <div className="f-title">
                Built to expand with your imagination.
              </div>
              <p style={{ fontSize: "12px", color: "#DCE1F5" }}>
                GraphMind is just the beginning. Future updates will include
                plugins, templates, and export options to match your creativity.
              </p>
            </div>
          </div>
        </section>
        <section className="cta-banner" aria-labelledby="cta-head">
          <div className="cta-banner-inner">
            <p className="cta-kicker">BEYOND SYMBOLS</p>
            <h2 id="cta-head" className="cta-headline">
              Math begins in abstraction and finds its proof in the graph.
            </h2>
            <p className="cta-sub">
              Draw your space with a single equation. <br />
              Explore, learn, and create in real-time 3D.
            </p>
            <button
              className="cta-large"
              onClick={() => nav("/studio")}
              aria-label="그래프를 그리다 페이지로 이동"
            >
              Draw Now Graphs
            </button>
          </div>
        </section>
      </main>

      <footer className="intro-footer">© 2025 Designed by (ppssj)</footer>
    </div>
  );
}
