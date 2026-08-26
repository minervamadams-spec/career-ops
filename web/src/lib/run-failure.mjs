const AUTH_RE = /(?:unauthorized|forbidden|not authenticated|authentication (?:failed|required)|please (?:log|sign) in|(?:log|sign)[ -]?in required|invalid (?:api[ -]?key|credential|token)|missing (?:api[ -]?key|credential|token)|credential.*(?:expired|missing|invalid)|api[ -]?key.*(?:expired|missing|invalid))/i;

/** Classify a failed CLI run from observed facts, never from a generic guess. */
export function classifyRunFailure({ timedOut, timeoutMs, diagnostics = "", code, signal, emittedText }) {
  if (timedOut) {
    const mins = timeoutMs ? Math.max(1, Math.round(timeoutMs / 60_000)) : 10;
    return {
      kind: "timeout",
      message: `The run reached its ${mins}-minute time limit. Any saved result remains available; otherwise retry.`,
    };
  }
  if (AUTH_RE.test(diagnostics)) {
    return {
      kind: "auth",
      message: "The CLI reported an authentication problem. Sign in to that CLI, then retry.",
    };
  }
  const detail = diagnostics.trim().replace(/\s+/g, " ").slice(0, 180);
  const exit = signal ? `signal ${signal}` : code == null ? "an unknown exit status" : `exit code ${code}`;
  return {
    kind: "process",
    message: detail
      ? `The CLI stopped before the evaluation finished (${exit}): ${detail}`
      : `The CLI stopped before the evaluation finished (${exit}${emittedText ? ", after producing partial output" : ""}). Retry or inspect the CLI directly.`,
  };
}

export function isAuthenticationDiagnostic(text) {
  return AUTH_RE.test(text);
}

/** The engine chosen in Config is authoritative for every run kind. */
export function configuredRunCli(cliId) {
  return cliId;
}
