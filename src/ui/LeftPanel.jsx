// src/ui/LeftPanel.jsx
export default function LeftPanel({ onOpenQuick, onNew }) {
  const QUICK = [
    "x",
    "x^2",
    "x^3 - 2*x",
    "sin(x)",
    "cos(x)",
    "tan(x)",
    "exp(x)-1",
    "log(x+1)",
  ];

  return (
    <aside className="left-panel explorer">
      <div className="section">
        <div className="label">Open Graph</div>
        <button className="btn solid" onClick={onNew}>+ New Graph</button>
      </div>

      <div className="section">
        <div className="label">Quick Picks</div>
        <ul className="quick-list">
          {QUICK.map((q) => (
            <li key={q}>
              <button className="btn ghost" onClick={() => onOpenQuick(q)}>
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="note">
        Tip: 상단 탭을 드래그해서 오른쪽으로 떼면 VSCode처럼 화면이 분할돼요.
      </div>
    </aside>
  );
}
