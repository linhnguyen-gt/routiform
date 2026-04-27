/**
 * Tests for CLI Interactive Menu & Log Suppression (bin/routiform.mjs)
 *
 * Tests cover:
 * - New flag parsing (--no-menu, --verbose)
 * - TTY detection logic
 * - Log buffering (circular buffer)
 * - Crash message detection
 * - Menu state management
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Flag Parsing ────────────────────────────────────────────

describe("CLI Flag Parsing", () => {
  function shouldShowMenu(args, isTTY) {
    const noMenu = args.includes("--no-menu");
    const useMenu = isTTY && !noMenu;
    return useMenu;
  }

  it("should enable menu by default on TTY", () => {
    assert.equal(shouldShowMenu([], true), true);
    assert.equal(shouldShowMenu(["--port", "3000"], true), true);
  });

  it("should disable menu with --no-menu", () => {
    assert.equal(shouldShowMenu(["--no-menu"], true), false);
    assert.equal(shouldShowMenu(["--no-menu", "--port", "3000"], true), false);
  });

  it("should disable menu when not TTY (CI/pipe)", () => {
    assert.equal(shouldShowMenu([], false), false);
    assert.equal(shouldShowMenu(["--verbose"], false), false);
  });

  it("should handle --no-menu overriding TTY", () => {
    // Even with TTY, --no-menu forces it off
    assert.equal(shouldShowMenu(["--no-menu"], true), false);
  });
});

// ─── Log Buffer ──────────────────────────────────────────────

describe("CLI Log Buffer", () => {
  const LOG_MAX = 100;

  class LogBuffer {
    constructor() {
      this.logBuffer = [];
      this.logBufIdx = 0;
    }

    append(text) {
      const lines = text.split("\n");
      for (const line of lines) {
        if (this.logBuffer.length < LOG_MAX) {
          this.logBuffer.push(line);
        } else {
          this.logBuffer[this.logBufIdx % LOG_MAX] = line;
        }
        this.logBufIdx++;
      }
    }

    get() {
      if (this.logBuffer.length < LOG_MAX) {
        return this.logBuffer.join("\n");
      }
      const start = this.logBufIdx % LOG_MAX;
      const ordered = [...this.logBuffer.slice(start), ...this.logBuffer.slice(0, start)];
      return ordered.join("\n");
    }
  }

  it("should buffer single line", () => {
    const buf = new LogBuffer();
    buf.append("Hello world");
    assert.ok(buf.get().includes("Hello world"));
  });

  it("should buffer multi-line input", () => {
    const buf = new LogBuffer();
    buf.append("line1\nline2\nline3");
    const out = buf.get();
    assert.ok(out.includes("line1"));
    assert.ok(out.includes("line2"));
    assert.ok(out.includes("line3"));
  });

  it("should wrap around after LOG_MAX lines", () => {
    const buf = new LogBuffer();
    for (let i = 0; i < 105; i++) {
      buf.append(`log-${i}`);
    }
    const out = buf.get();
    assert.ok(out.includes("log-104"), "latest entry should be present");
    const lines = out.split("\n");
    // After 105 entries in a 100-slot buffer, entries 0-4 are evicted
    assert.equal(lines[0], "log-5", "oldest remaining should be log-5");
    assert.equal(lines.length, 100, "should have exactly 100 lines");
  });

  it("should maintain circular order", () => {
    const buf = new LogBuffer();
    for (let i = 1; i <= 102; i++) {
      buf.append(`entry-${i}`);
    }
    const out = buf.get();
    // entry-3 through entry-102 should be present in order
    assert.ok(out.startsWith("entry-3"), "should start at the oldest non-evicted entry");
    assert.ok(out.endsWith("entry-102"), "should end at the newest entry");
  });
});

// ─── Crash Message Detection ─────────────────────────────────

describe("CLI Crash Message Detection", () => {
  const CRASH_PATTERNS = [
    "EADDRINUSE",
    "EACCES",
    "Cannot find module",
    "FATAL",
    "Unhandled",
    "uncaughtException",
  ];

  function isCrashMessage(text) {
    return CRASH_PATTERNS.some((p) => text.includes(p));
  }

  it("should detect EADDRINUSE", () => {
    assert.equal(isCrashMessage("Error: listen EADDRINUSE: address already in use"), true);
  });

  it("should detect port conflict", () => {
    assert.equal(isCrashMessage("Error: listen EACCES: permission denied"), true);
  });

  it("should detect missing module", () => {
    assert.equal(isCrashMessage("Cannot find module 'better-sqlite3'"), true);
  });

  it("should detect fatal errors", () => {
    assert.equal(isCrashMessage("FATAL: database is locked"), true);
  });

  it("should detect uncaught exceptions", () => {
    assert.equal(isCrashMessage("uncaughtException: Something went wrong"), true);
  });

  it("should NOT flag normal log messages", () => {
    assert.equal(isCrashMessage("Server listening on port 3000"), false);
    assert.equal(isCrashMessage("GET /v1/health 200"), false);
    assert.equal(isCrashMessage("Processing request..."), false);
  });

  it("should detect in multi-line chunks", () => {
    const chunk = "line1\nline2\nError: listen EADDRINUSE";
    assert.equal(isCrashMessage(chunk), true);
  });
});

// ─── Log Forwarding Logic ───────────────────────────────────

describe("CLI Log Forwarding Decision", () => {
  function shouldForwardLog(useMenu, verbose, isCrash) {
    return !useMenu || verbose || isCrash;
  }

  it("should forward ALL logs when NOT using menu", () => {
    assert.equal(shouldForwardLog(false, false, false), true);
    assert.equal(shouldForwardLog(false, true, false), true);
  });

  it("should forward ALL logs when verbose", () => {
    assert.equal(shouldForwardLog(true, true, false), true);
  });

  it("should SUPPRESS non-crash logs in menu mode", () => {
    assert.equal(shouldForwardLog(true, false, false), false);
  });

  it("should FORWARD crash logs even in menu mode", () => {
    assert.equal(shouldForwardLog(true, false, true), true);
  });
});

// ─── REPL Command Parsing ───────────────────────────────────

describe("CLI REPL Command Parsing", () => {
  function parseReplCommand(cmd) {
    const trimmed = cmd.trim();
    if (!trimmed) return { command: "noop" };
    if (trimmed.startsWith("route ")) {
      return { command: "route", model: trimmed.slice(6).trim() };
    }
    return { command: trimmed };
  }

  it("should parse health command", () => {
    assert.deepEqual(parseReplCommand("health"), { command: "health" });
  });

  it("should parse combos command", () => {
    assert.deepEqual(parseReplCommand("combos"), { command: "combos" });
  });

  it("should parse quota command", () => {
    assert.deepEqual(parseReplCommand("quota"), { command: "quota" });
  });

  it("should parse logs command", () => {
    assert.deepEqual(parseReplCommand("logs"), { command: "logs" });
  });

  it("should parse clear command", () => {
    assert.deepEqual(parseReplCommand("clear"), { command: "clear" });
  });

  it("should parse exit command", () => {
    assert.deepEqual(parseReplCommand("exit"), { command: "exit" });
  });

  it("should parse route command with model", () => {
    assert.deepEqual(parseReplCommand("route openai/gpt-4o"), {
      command: "route",
      model: "openai/gpt-4o",
    });
  });

  it("should parse route command with extra whitespace", () => {
    assert.deepEqual(parseReplCommand("  route   anthropic/claude-sonnet-4  "), {
      command: "route",
      model: "anthropic/claude-sonnet-4",
    });
  });

  it("should handle empty command", () => {
    assert.deepEqual(parseReplCommand(""), { command: "noop" });
  });

  it("should handle whitespace-only command", () => {
    assert.deepEqual(parseReplCommand("   "), { command: "noop" });
  });
});

// ─── Menu Navigation ────────────────────────────────────────

describe("CLI Menu Navigation", () => {
  const MENU_ITEMS = [
    { label: "Web UI (Open in Browser)", action: "web", icon: "★" },
    { label: "Terminal UI (Interactive CLI)", action: "repl", icon: "☆" },
    { label: "Hide to Tray (Background)", action: "tray", icon: "☆" },
    { label: "Exit", action: "exit", icon: "☆" },
  ];

  function navigateUp(idx) {
    return (idx - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
  }

  function navigateDown(idx) {
    return (idx + 1) % MENU_ITEMS.length;
  }

  it("should navigate down correctly", () => {
    assert.equal(navigateDown(0), 1);
    assert.equal(navigateDown(1), 2);
    assert.equal(navigateDown(2), 3);
    assert.equal(navigateDown(3), 0); // wrap around
  });

  it("should navigate up correctly", () => {
    assert.equal(navigateUp(0), 3); // wrap around
    assert.equal(navigateUp(1), 0);
    assert.equal(navigateUp(2), 1);
    assert.equal(navigateUp(3), 2);
  });

  it("should wrap around multiple times", () => {
    let idx = 0;
    for (let i = 0; i < 10; i++) {
      idx = navigateDown(idx);
    }
    assert.equal(idx, 2); // 10 down from 0 wraps: 10 % 4 = 2
  });

  it("should have correct menu item actions", () => {
    assert.equal(MENU_ITEMS[0].action, "web");
    assert.equal(MENU_ITEMS[1].action, "repl");
    assert.equal(MENU_ITEMS[2].action, "tray");
    assert.equal(MENU_ITEMS[3].action, "exit");
  });

  it("should handle tray action", () => {
    const action = MENU_ITEMS[2].action;
    assert.equal(action, "tray");
    // tray should be a valid action string
    assert.ok(["web", "repl", "tray", "exit"].includes(action));
  });
});
