import test from "node:test";
import assert from "node:assert/strict";
import { classifyRunFailure, configuredRunCli, isAuthenticationDiagnostic } from "../../src/lib/run-failure.mjs";

test("a timeout is not misreported as authentication", () => {
  const result = classifyRunFailure({ timedOut: true, diagnostics: "", code: null, signal: "SIGTERM", emittedText: false });
  assert.equal(result.kind, "timeout");
  assert.match(result.message, /time limit/i);
  assert.doesNotMatch(result.message, /sign in|authenticated/i);
});

test("explicit authentication output is classified as auth", () => {
  const result = classifyRunFailure({ timedOut: false, diagnostics: "Authentication failed: please login", code: 1, signal: null, emittedText: false });
  assert.equal(result.kind, "auth");
  assert.match(result.message, /authentication problem/i);
});

test("an unexplained non-zero exit remains a process failure", () => {
  const result = classifyRunFailure({ timedOut: false, diagnostics: "worker crashed", code: 2, signal: null, emittedText: true });
  assert.equal(result.kind, "process");
  assert.match(result.message, /exit code 2/);
  assert.doesNotMatch(result.message, /sign in|authenticated/i);
});

test("broad warning words do not imply authentication", () => {
  assert.equal(isAuthenticationDiagnostic("MCP plugin login helper unavailable; continuing"), false);
  assert.equal(isAuthenticationDiagnostic("Unauthorized: invalid API key"), true);
});

test("the configured engine is not silently replaced", () => {
  assert.equal(configuredRunCli("codex"), "codex");
  assert.equal(configuredRunCli("claude"), "claude");
});
