function Box({ title, note, tone = "surface" }: { title: string; note?: string; tone?: "surface" | "accent" | "store" }) {
  const bg =
    tone === "accent"
      ? "color-mix(in srgb, var(--accent) 20%, var(--surface))"
      : tone === "store"
        ? "color-mix(in srgb, var(--accent-strong) 12%, var(--surface))"
        : "var(--surface)";
  return (
    <div
      style={{
        background: bg,
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "0.7rem 0.9rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.72rem",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </div>
      {note && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.64rem",
            color: "var(--text-faint)",
            marginTop: "0.2rem",
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.62rem",
          color: "var(--text-faint)",
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--text-faint)", fontSize: "0.8rem", lineHeight: 1 }}>↓</span>
    </div>
  );
}

/** Top-to-bottom data-flow diagram of the ingestion pipeline. */
export default function ArchitectureDiagram() {
  return (
    <div style={{ margin: "1.75em 0" }}>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.78rem",
          color: "var(--text-faint)",
          marginBottom: "0.75em",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        pipeline
      </p>

      <Box
        title="Deribit WSS"
        note="ticker.{instrument}.100ms · ~1,300 channels · 200–400 msg/sec"
      />
      <Arrow label="bytes" />

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <Box title="readLoop → buffered chan (1000) → worker pool (10–30)" tone="accent" note="sonic JSON · lock-free sync.Map · Black-Scholes lookup" />
      </div>
      <Arrow label="fan out" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.6rem",
        }}
      >
        <Box title="Redis 7" note="live state · L1 LRU · Pub/Sub" tone="store" />
        <Box title="TimescaleDB" note="1m / 15m / 1h aggregates" tone="store" />
      </div>
      <Arrow label="/ws" />

      <Box title="React dashboard" note="virtualized table · 3D IV surface · PnL" />
    </div>
  );
}
