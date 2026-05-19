import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { ValidationError } from "./errors.js";
import {
  assertNoSymlink,
  canonicalRoot,
  canonicalSkillDir,
  validateSkillName,
} from "./paths.js";

const SKILL_NAME_RE = /^[a-z][a-z0-9-]{0,48}$/;

export const FrontmatterSchema = z.object({
  name: z.string().regex(SKILL_NAME_RE),
  description: z.string().min(1).max(1024),
});
export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export const ProviderSchema = z.enum(["anthropic", "openai"]);
export type Provider = z.infer<typeof ProviderSchema>;

export const SkillJsonSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().regex(SKILL_NAME_RE),
  createdAt: z.string().min(1),
  llm: z.object({
    provider: ProviderSchema,
    model: z.string().min(1),
  }),
});
export type SkillJson = z.infer<typeof SkillJsonSchema>;

export interface CanonicalSkill {
  readonly name: string;
  readonly description: string;
  readonly body: string;
  readonly metadata: SkillJson;
}

export interface NewSkillInput {
  readonly name: string;
  readonly description: string;
  readonly body: string;
  readonly llm: { readonly provider: Provider; readonly model: string };
}

export interface TargetFile {
  readonly relPath: string;
  readonly contents: string;
}

export interface TargetContent {
  readonly name: string;
  readonly files: ReadonlyArray<TargetFile>;
}

export function writeSkill(input: NewSkillInput): CanonicalSkill {
  validateSkillName(input.name);
  const root = canonicalRoot();
  const destDir = canonicalSkillDir(input.name);
  const skillsDir = path.join(root, "skills");

  fs.mkdirSync(skillsDir, { recursive: true });
  assertNoSymlink(skillsDir);

  if (fs.existsSync(destDir)) {
    throw new ValidationError(
      `A skill named '${input.name}' already exists — delete it first, or choose a different name.`,
    );
  }

  const validFrontmatter = parseOrValidationError(
    FrontmatterSchema,
    { name: input.name, description: input.description },
    "Skill frontmatter",
  );
  const metadata: SkillJson = parseOrValidationError(
    SkillJsonSchema,
    {
      schemaVersion: 1,
      name: input.name,
      createdAt: new Date().toISOString(),
      llm: { provider: input.llm.provider, model: input.llm.model },
    },
    "Skill metadata",
  );

  const skillMd = serializeSkillMd(validFrontmatter, input.body);
  const skillJson = JSON.stringify(metadata, null, 2) + "\n";

  const tempDir = path.join(
    skillsDir,
    `.tmp-${input.name}-${process.pid}-${Date.now()}`,
  );

  try {
    fs.mkdirSync(tempDir);
    assertNoSymlink(tempDir);
    fs.writeFileSync(path.join(tempDir, "SKILL.md"), skillMd, "utf8");
    fs.writeFileSync(path.join(tempDir, "skill.json"), skillJson, "utf8");

    if (fs.existsSync(destDir)) {
      throw new ValidationError(
        `A skill named '${input.name}' already exists — delete it first, or choose a different name.`,
      );
    }
    fs.renameSync(tempDir, destDir);
  } catch (err) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
    throw err;
  }

  return {
    name: input.name,
    description: validFrontmatter.description,
    body: input.body,
    metadata,
  };
}

export function readSkill(name: string): CanonicalSkill {
  const dir = canonicalSkillDir(name);
  assertNoSymlink(dir);

  if (!fs.existsSync(dir)) {
    throw new ValidationError(
      `No skill named '${name}' — run 'skillsync list' to see what exists.`,
    );
  }

  const skillMdPath = path.join(dir, "SKILL.md");
  const skillJsonPath = path.join(dir, "skill.json");

  if (!fs.existsSync(skillMdPath)) {
    throw new ValidationError(
      `Skill '${name}' is missing SKILL.md — the directory is incomplete.`,
    );
  }
  if (!fs.existsSync(skillJsonPath)) {
    throw new ValidationError(
      `Skill '${name}' is missing skill.json — the directory is incomplete.`,
    );
  }

  const skillMdRaw = fs.readFileSync(skillMdPath, "utf8");
  const skillJsonRaw = fs.readFileSync(skillJsonPath, "utf8");

  const { frontmatter, body } = parseFrontmatter(skillMdRaw);
  const validFrontmatter = parseOrValidationError(
    FrontmatterSchema,
    frontmatter,
    `Frontmatter of '${name}'`,
  );

  let metadataJson: unknown;
  try {
    metadataJson = JSON.parse(skillJsonRaw);
  } catch {
    throw new ValidationError(
      `Skill '${name}' has malformed skill.json — invalid JSON.`,
    );
  }
  const metadata = parseOrValidationError(
    SkillJsonSchema,
    metadataJson,
    `Metadata of '${name}'`,
  );

  if (validFrontmatter.name !== name || metadata.name !== name) {
    throw new ValidationError(
      `Skill '${name}' has inconsistent names — directory='${name}', frontmatter='${validFrontmatter.name}', metadata='${metadata.name}'. Fix the disagreement before using the skill.`,
    );
  }

  return {
    name,
    description: validFrontmatter.description,
    body,
    metadata,
  };
}

export function listSkills(): CanonicalSkill[] {
  const skillsDir = path.join(canonicalRoot(), "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skills: CanonicalSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!SKILL_NAME_RE.test(entry.name)) continue;
    skills.push(readSkill(entry.name));
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function softDeleteSkill(name: string): string {
  const dir = canonicalSkillDir(name);
  assertNoSymlink(dir);

  if (!fs.existsSync(dir)) {
    throw new ValidationError(
      `No skill named '${name}' — run 'skillsync list' to see what exists.`,
    );
  }

  const trashRoot = path.join(canonicalRoot(), "trash");
  fs.mkdirSync(trashRoot, { recursive: true });
  assertNoSymlink(trashRoot);

  const trashDir = uniqueTrashPath(trashRoot, name);
  fs.renameSync(dir, trashDir);
  return trashDir;
}

function uniqueTrashPath(trashRoot: string, name: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  let candidate = path.join(trashRoot, `${name}-${timestamp}`);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(trashRoot, `${name}-${timestamp}-${counter}`);
    counter += 1;
  }
  return candidate;
}

export function readSkillForTarget(name: string): TargetContent {
  const skill = readSkill(name);
  const frontmatter: Frontmatter = {
    name: skill.name,
    description: skill.description,
  };
  return {
    name: skill.name,
    files: [
      {
        relPath: "SKILL.md",
        contents: serializeSkillMd(frontmatter, skill.body),
      },
    ],
  };
}

function serializeSkillMd(frontmatter: Frontmatter, body: string): string {
  return (
    "---\n" +
    `name: ${frontmatter.name}\n` +
    `description: ${yamlQuote(frontmatter.description)}\n` +
    "---\n" +
    body
  );
}

function parseFrontmatter(text: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new ValidationError(
      "SKILL.md must start with a '---' YAML frontmatter delimiter.",
    );
  }
  const closeIdx = normalized.indexOf("\n---\n", 4);
  if (closeIdx === -1) {
    throw new ValidationError(
      "SKILL.md frontmatter is missing the closing '---' delimiter.",
    );
  }
  const frontmatterText = normalized.slice(4, closeIdx);
  const body = normalized.slice(closeIdx + "\n---\n".length);

  const frontmatter: Record<string, unknown> = {};
  for (const line of frontmatterText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      throw new ValidationError(
        `Invalid frontmatter line — expected 'key: value', got '${line}'.`,
      );
    }
    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();
    frontmatter[key] = yamlUnquote(rawValue);
  }
  return { frontmatter, body };
}

function yamlQuote(s: string): string {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

function yamlUnquote(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return yamlUnescape(s.slice(1, -1));
  }
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

function yamlUnescape(s: string): string {
  let result = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "\\" && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === "n") result += "\n";
      else if (next === "t") result += "\t";
      else if (next === "r") result += "\r";
      else if (next === '"') result += '"';
      else if (next === "\\") result += "\\";
      else result += next;
      i += 2;
    } else {
      result += s[i];
      i += 1;
    }
  }
  return result;
}

function parseOrValidationError<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label: string,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues
    .map((issue) => {
      const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${where}${issue.message}`;
    })
    .join("; ");
  throw new ValidationError(`${label} is invalid — ${issues}.`);
}
