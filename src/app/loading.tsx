export default function Loading() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">T</span>
          <span>TeamFlow</span>
        </div>
        <div className="panel" style={{ marginTop: 16, padding: 16, opacity: 0.7 }}>
          <p className="eyebrow">LOADING</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 20 }}>Opening workspace…</h2>
        </div>
      </aside>

      <main className="main">
        <header>
          <div className="search" aria-hidden="true">
            <span>⌕</span>
            <input disabled value="Loading TeamFlow…" readOnly />
            <kbd>Ctrl K</kbd>
          </div>
        </header>

        <div className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">TEAMFLOW</p>
              <h1>Loading…</h1>
              <p>Fetching the latest project data.</p>
            </div>
          </div>

          <section className="metrics" aria-label="Loading summary">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="panel" key={index} style={{ minHeight: 120, opacity: 0.7 }} />
            ))}
          </section>

          <div className="dashboard-grid">
            <section className="panel" style={{ minHeight: 280, opacity: 0.7 }} />
            <section className="panel" style={{ minHeight: 280, opacity: 0.7 }} />
          </div>
        </div>
      </main>
    </div>
  );
}
