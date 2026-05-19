import * as fs from "node:fs";
import * as path from "node:path";
import { PathRefusedError, ValidationError } from "./errors.js";

const SKILL_NAME_RE = /^[a-z][a-z0-9-]{0,48}$/;
const SKILL_NAME_HINT =
  "use lowercase letters, digits, and hyphens, starting with a letter (e.g. 'my-skill')";

export function validateSkillName(name: unknown): asserts name is string {
  if (typeof name !== "string" || name.length === 0) {
    throw new ValidationError(
      `Skill name is required — ${SKILL_NAME_HINT}.`,
    );
  }
  if (!SKILL_NAME_RE.test(name)) {
    throw new ValidationError(
      `'${name}' isn't a valid skill name — ${SKILL_NAME_HINT}.`,
    );
  }
}

export function homeDir(): string {
  const home = process.env.HOME;
  if (!home || home.length === 0) {
    throw new PathRefusedError(
      "HOME is not set — skillsync needs HOME to locate '~/.skillsync/'.",
    );
  }
  return home;
}

export function canonicalRoot(): string {
  return path.join(homeDir(), ".skillsync");
}

export function canonicalSkillDir(name: string): string {
  validateSkillName(name);
  const root = canonicalRoot();
  const candidate = path.join(root, "skills", name);
  assertUnderRoot(candidate, root);
  return candidate;
}

export function assertUnderRoot(candidate: string, root: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const rootWithSep = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;
  if (
    resolvedCandidate !== resolvedRoot &&
    !resolvedCandidate.startsWith(rootWithSep)
  ) {
    throw new PathRefusedError(
      `'${candidate}' resolves outside '${root}' — refusing to read or write there.`,
    );
  }
}

export function assertNoSymlink(p: string, stopAt: string = homeDir()): void {
  const resolved = path.resolve(p);
  const resolvedStop = path.resolve(stopAt);
  let current = resolved;
  while (true) {
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        throw new PathRefusedError(
          `Refusing to use symlink '${current}' — resolve the link or move the directory.`,
        );
      }
    } catch (err: unknown) {
      if (err instanceof PathRefusedError) throw err;
      if (!isErrnoException(err) || err.code !== "ENOENT") throw err;
    }
    if (current === resolvedStop) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export function codexHome(): string {
  const fromEnv = process.env.CODEX_HOME;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return path.join(homeDir(), ".codex");
}

export function codexSystemDir(): string {
  return path.join(codexHome(), "skills", ".system");
}

export function assertNotCodexSystem(p: string): void {
  const resolvedP = path.resolve(p);
  const reserved = path.resolve(codexSystemDir());
  const reservedWithSep = reserved.endsWith(path.sep)
    ? reserved
    : reserved + path.sep;
  if (resolvedP === reserved || resolvedP.startsWith(reservedWithSep)) {
    throw new PathRefusedError(
      `'${codexSystemDir()}' is reserved for OpenAI-shipped skills and cannot be modified.`,
    );
  }
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && typeof (err as { code?: unknown }).code === "string";
}
