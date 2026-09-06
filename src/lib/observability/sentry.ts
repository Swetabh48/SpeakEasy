/**
 * Lightweight Sentry-shaped reporting.
 * No-ops until NEXT_PUBLIC_SENTRY_DSN or SENTRY_DSN is set.
 * Full @sentry/nextjs can replace this later without changing call sites.
 */

type SentryLike = {
  captureException: (err: unknown, context?: Record<string, unknown>) => void;
  captureMessage: (msg: string, level?: "info" | "warning" | "error") => void;
};

function dsn(): string {
  return (
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    process.env.SENTRY_DSN?.trim() ||
    ""
  );
}

async function postSentry(payload: Record<string, unknown>) {
  const id = dsn();
  if (!id) return;
  // DSN form: https://<key>@<host>/<project>
  try {
    const u = new URL(id);
    const publicKey = u.username;
    const projectId = u.pathname.replace(/^\//, "");
    const ingest = `${u.protocol}//${u.host}/api/${projectId}/store/?sentry_version=7&sentry_key=${publicKey}`;
    await fetch(ingest, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        environment: process.env.SENTRY_ENVIRONMENT || "development",
        platform: "javascript",
      }),
    });
  } catch {
    /* never break the product for telemetry */
  }
}

export const sentry: SentryLike = {
  captureException(err, context) {
    if (!dsn()) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[sentry:noop]", err, context);
      }
      return;
    }
    void postSentry({
      message: {
        message: err instanceof Error ? err.message : String(err),
      },
      exception: {
        values: [
          {
            type: err instanceof Error ? err.name : "Error",
            value: err instanceof Error ? err.message : String(err),
          },
        ],
      },
      extra: context,
    });
  },
  captureMessage(msg, level = "info") {
    if (!dsn()) return;
    void postSentry({
      message: { message: msg },
      level,
    });
  },
};
