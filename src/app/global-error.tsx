"use client";
import "./globals.css";
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="bn">
      <body>
        <main className="auth-card card empty">
          <span className="empty-emoji">🫠</span>
          <h1>আড্ডায় একটু জট লেগেছে।</h1>
          <p>একটু পরে আবার চেষ্টা করো।</p>
          <button className="button button-primary" onClick={reset}>
            আবার দেখি
          </button>
        </main>
      </body>
    </html>
  );
}
