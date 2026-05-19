import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  assertNoSymlink,
  assertNotCodexSystem,
  assertUnderRoot,
  canonicalRoot,
  canonicalSkillDir,
  codexSystemDir,
  validateSkillName,
} from "../src/core/paths.js";
import { PathRefusedError, ValidationError } from "../src/core/errors.js";

let tmpHome: string;
let origHome: string | undefined;
let origCodexHome: string | undefined;

beforeEach(() => {
  origHome = process.env.HOME;
  origCodexHome = process.env.CODEX_HOME;
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "skillsync-test-"));
  process.env.HOME = tmpHome;
  delete process.env.CODEX_HOME;
});

afterEach(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = origCodexHome;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe("validateSkillName", () => {
  it.each<[string, string]>([
    ["..", "traversal"],
    ["/abs", "absolute"],
    ["", "empty"],
    ["FOO", "uppercase"],
    ["a".repeat(50), "overlong (max is 49)"],
    ["1leading", "leading digit"],
    ["-leading", "leading hyphen"],
    ["foo/bar", "contains slash"],
    ["foo bar", "contains space"],
    ["foo_bar", "contains underscore"],
    ["foo.bar", "contains dot"],
  ])("rejects %j (%s)", (name) => {
    expect(() => validateSkillName(name)).toThrow(ValidationError);
  });

  it("rejects non-string input", () => {
    expect(() => validateSkillName(undefined)).toThrow(ValidationError);
    expect(() => validateSkillName(123 as unknown)).toThrow(ValidationError);
  });

  it("accepts valid names", () => {
    expect(() => validateSkillName("a")).not.toThrow();
    expect(() => validateSkillName("my-skill")).not.toThrow();
    expect(() => validateSkillName("foo123")).not.toThrow();
    expect(() => validateSkillName("a".repeat(49))).not.toThrow();
  });

  it("error message names the offending input and cites the rule", () => {
    try {
      validateSkillName("My-Skill");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const message = (err as Error).message;
      expect(message).toContain("'My-Skill'");
      expect(message.toLowerCase()).toContain("lowercase");
    }
  });
});

describe("canonicalRoot", () => {
  it("returns ~/.skillsync under the current HOME", () => {
    expect(canonicalRoot()).toBe(path.join(tmpHome, ".skillsync"));
  });

  it("refuses when HOME is unset", () => {
    delete process.env.HOME;
    expect(() => canonicalRoot()).toThrow(PathRefusedError);
  });

  it("refuses when HOME is empty", () => {
    process.env.HOME = "";
    expect(() => canonicalRoot()).toThrow(PathRefusedError);
  });
});

describe("canonicalSkillDir", () => {
  it("returns the canonical skill path", () => {
    expect(canonicalSkillDir("my-skill")).toBe(
      path.join(tmpHome, ".skillsync", "skills", "my-skill"),
    );
  });

  it("rejects traversal in the name before computing a path", () => {
    expect(() => canonicalSkillDir("..")).toThrow(ValidationError);
    expect(() => canonicalSkillDir("../evil")).toThrow(ValidationError);
  });
});

describe("assertUnderRoot", () => {
  it("accepts a child path", () => {
    const root = path.join(tmpHome, ".skillsync");
    expect(() =>
      assertUnderRoot(path.join(root, "skills", "foo"), root),
    ).not.toThrow();
  });

  it("accepts the root itself", () => {
    const root = path.join(tmpHome, ".skillsync");
    expect(() => assertUnderRoot(root, root)).not.toThrow();
  });

  it("rejects sibling paths reached via traversal", () => {
    const root = path.join(tmpHome, ".skillsync");
    expect(() =>
      assertUnderRoot(path.join(root, "..", "evil"), root),
    ).toThrow(PathRefusedError);
  });

  it("rejects unrelated absolute paths", () => {
    const root = path.join(tmpHome, ".skillsync");
    expect(() => assertUnderRoot("/tmp/elsewhere", root)).toThrow(
      PathRefusedError,
    );
  });

  it("rejects a path whose name is a prefix of root but isn't a child", () => {
    const root = path.join(tmpHome, ".skillsync");
    expect(() => assertUnderRoot(root + "-evil", root)).toThrow(
      PathRefusedError,
    );
  });
});

describe("assertNoSymlink", () => {
  it("accepts a normal directory", () => {
    const dir = path.join(tmpHome, "normal");
    fs.mkdirSync(dir, { recursive: true });
    expect(() => assertNoSymlink(dir)).not.toThrow();
  });

  it("accepts a path that doesn't exist yet when ancestors are normal", () => {
    const dir = path.join(tmpHome, "exists");
    fs.mkdirSync(dir, { recursive: true });
    expect(() =>
      assertNoSymlink(path.join(dir, "future-child")),
    ).not.toThrow();
  });

  it("refuses a path that is itself a symlink", () => {
    const target = path.join(tmpHome, "real");
    const link = path.join(tmpHome, "link");
    fs.mkdirSync(target, { recursive: true });
    fs.symlinkSync(target, link);
    expect(() => assertNoSymlink(link)).toThrow(/symlink/);
  });

  it("refuses a path that sits beneath a symlinked parent", () => {
    const target = path.join(tmpHome, "real");
    const link = path.join(tmpHome, "link");
    fs.mkdirSync(target, { recursive: true });
    fs.symlinkSync(target, link);
    expect(() => assertNoSymlink(path.join(link, "child"))).toThrow(/symlink/);
  });

  it("does not walk above the stopAt directory", () => {
    // tmpHome itself sits under /var/folders on macOS, where /var is a
    // symlink. Capping the walk at HOME means we never refuse based on
    // those system-level links.
    const dir = path.join(tmpHome, "deep", "nested", "file");
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.writeFileSync(dir, "");
    expect(() => assertNoSymlink(dir)).not.toThrow();
  });
});

describe("assertNotCodexSystem", () => {
  it("refuses the default ~/.codex/skills/.system directory", () => {
    const p = path.join(tmpHome, ".codex", "skills", ".system");
    expect(() => assertNotCodexSystem(p)).toThrow(PathRefusedError);
  });

  it("refuses children under .system", () => {
    const p = path.join(tmpHome, ".codex", "skills", ".system", "foo");
    expect(() => assertNotCodexSystem(p)).toThrow(PathRefusedError);
  });

  it("respects CODEX_HOME override", () => {
    const altCodex = path.join(tmpHome, "alt-codex");
    process.env.CODEX_HOME = altCodex;
    expect(codexSystemDir()).toBe(path.join(altCodex, "skills", ".system"));
    expect(() =>
      assertNotCodexSystem(path.join(altCodex, "skills", ".system", "x")),
    ).toThrow(PathRefusedError);
    // The default location is no longer reserved when CODEX_HOME points
    // elsewhere — only the configured one is.
    expect(() =>
      assertNotCodexSystem(
        path.join(tmpHome, ".codex", "skills", ".system", "x"),
      ),
    ).not.toThrow();
  });

  it("accepts a sibling skill under ~/.codex/skills/", () => {
    expect(() =>
      assertNotCodexSystem(path.join(tmpHome, ".codex", "skills", "my-skill")),
    ).not.toThrow();
  });

  it("rejects an adversarial skill name encoded as traversal", () => {
    // canonicalSkillDir() rejects '..' at validateSkillName, but the
    // .system/ guard is a separate belt-and-braces check applied to a
    // resolved path.
    const adversarial = path.join(
      tmpHome,
      ".codex",
      "skills",
      "..",
      "skills",
      ".system",
      "x",
    );
    expect(() => assertNotCodexSystem(adversarial)).toThrow(PathRefusedError);
  });
});
