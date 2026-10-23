"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#04060b", color: "#e3e9f2", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 480, margin: "20vh auto", padding: 16 }}>
          <h1 style={{ fontSize: 20 }}>NEXUS hit an unexpected error</h1>
          <p style={{ color: "#7d8aa1" }}>Please reload the page. If it keeps happening, check the server logs.</p>
          <button
            onClick={reset}
            style={{ marginTop: 16, padding: "8px 14px", borderRadius: 8, border: "1px solid #334", background: "#0e1626", color: "inherit" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
