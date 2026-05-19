import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  listSkills,
  readSkill,
  readSkillForTarget,
  softDeleteSkill,
  writeSkill,
} from "../src/core/skill.js";
import { ValidationError } from "../src/core/errors.js";

let tmpHome: string;
let origHome: string | undefined;

beforeEach(() => {
  origHome = process.env.HOME;
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "skillsync-skill-test-"));
  process.env.HOME = tmpHome;
});

afterEach(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

const baseInput = {
  name: "my-skill",
  description: "A helpful skill.",
  body: "# my-skill\n\nDoes useful things.\n",
  llm: { provider: "anthropic" as const, model: "claude-sonnet-4-6" },
};

describe("writeSkill", () => {
  it("creates SKILL.md and skill.json under the canonical root", () => {
    writeSkill(baseInput);
    const dir = path.join(tmpHome, ".skillsync", "skills", "my-skill");
    expect(fs.existsSync(path.join(dir, "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "skill.json"))).toBe(true);
  });

  it("refuses to overwrite an existing skill", () => {
    writeSkill(baseInput);
    expect(() => writeSkill(baseInput)).toThrow(ValidationError);
    expect(() => writeSkill(baseInput)).toThrow(/already exists/);
  });

  it("rejects invalid names before any FS work", () => {
    expect(() => writeSkill({ ...baseInput, name: "BadName" })).toThrow(
      ValidationError,
    );
    expect(
      fs.existsSync(path.join(tmpHome, ".skillsync", "skills")),
    ).toBe(false);
  });

  it("leaves no temp directory behind when validation fails mid-write", () => {
    expect(() =>
      writeSkill({ ...baseInput, description: "" }),
    ).toThrow(ValidationError);
    const skillsDir = path.join(tmpHome, ".skillsync", "skills");
    if (fs.existsSync(skillsDir)) {
      const remaining = fs.readdirSync(skillsDir);
      expect(remaining.filter((n) => n.startsWith(".tmp-"))).toEqual([]);
    }
  });
});

describe("readSkill / writeSkill round-trip", () => {
  it("returns equal content for plain ASCII bodies", () => {
    const written = writeSkill(baseInput);
    const read = readSkill("my-skill");
    expect(read.name).toBe(written.name);
    expect(read.description).toBe(written.description);
    expect(read.body).toBe(written.body);
    expect(read.metadata).toEqual(written.metadata);
  });

  it("preserves YAML-special characters in description", () => {
    const tricky =
      'A description with: colons, "quotes", \\backslashes, and\nnewlines.';
    writeSkill({ ...baseInput, description: tricky });
    const read = readSkill("my-skill");
    expect(read.description).toBe(tricky);
  });

  it("preserves multi-paragraph markdown body verbatim", () => {
    const body =
      "# Title\n\nFirst paragraph with **bold** text.\n\n## Section\n\n- item one\n- item two\n\n```js\nconst x = 1;\n```\n";
    writeSkill({ ...baseInput, body });
    expect(readSkill("my-skill").body).toBe(body);
  });

  it("preserves provider and model in metadata", () => {
    writeSkill({
      ...baseInput,
      llm: { provider: "openai", model: "gpt-5-mini" },
    });
    const read = readSkill("my-skill");
    expect(read.metadata.llm).toEqual({
      provider: "openai",
      model: "gpt-5-mini",
    });
    expect(read.metadata.schemaVersion).toBe(1);
  });
});

describe("readSkill error cases", () => {
  it("throws ValidationError when the skill doesn't exist", () => {
    expect(() => readSkill("ghost")).toThrow(/No skill named 'ghost'/);
  });

  it("throws a clear zod-derived error on malformed frontmatter", () => {
    writeSkill(baseInput);
    const skillMdPath = path.join(
      tmpHome,
      ".skillsync",
      "skills",
      "my-skill",
      "SKILL.md",
    );
    fs.writeFileSync(skillMdPath, "---\nname: my-skill\n---\nbody\n", "utf8");
    let caught: unknown;
    try {
      readSkill("my-skill");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    const message = (caught as Error).message;
    expect(message).toContain("description");
  });

  it("throws when SKILL.md has no closing delimiter", () => {
    writeSkill(baseInput);
    const skillMdPath = path.join(
      tmpHome,
      ".skillsync",
      "skills",
      "my-skill",
      "SKILL.md",
    );
    fs.writeFileSync(
      skillMdPath,
      "---\nname: my-skill\ndescription: foo\nstill-no-close\n",
      "utf8",
    );
    expect(() => readSkill("my-skill")).toThrow(/closing '---'/);
  });

  it("throws when skill.json is not valid JSON", () => {
    writeSkill(baseInput);
    const jsonPath = path.join(
      tmpHome,
      ".skillsync",
      "skills",
      "my-skill",
      "skill.json",
    );
    fs.writeFileSync(jsonPath, "{not json", "utf8");
    expect(() => readSkill("my-skill")).toThrow(/malformed skill.json/);
  });

  it("rejects name-consistency mismatch between dir and frontmatter", () => {
    writeSkill(baseInput);
    const skillMdPath = path.join(
      tmpHome,
      ".skillsync",
      "skills",
      "my-skill",
      "SKILL.md",
    );
    fs.writeFileSync(
      skillMdPath,
      '---\nname: other-name\ndescription: "x"\n---\nbody\n',
      "utf8",
    );
    expect(() => readSkill("my-skill")).toThrow(/inconsistent names/);
  });

  it("rejects name-consistency mismatch between dir and skill.json", () => {
    writeSkill(baseInput);
    const jsonPath = path.join(
      tmpHome,
      ".skillsync",
      "skills",
      "my-skill",
      "skill.json",
    );
    const meta = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    meta.name = "other-name";
    fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));
    expect(() => readSkill("my-skill")).toThrow(/inconsistent names/);
  });

  it("rejects unsupported provider in skill.json", () => {
    writeSkill(baseInput);
    const jsonPath = path.join(
      tmpHome,
      ".skillsync",
      "skills",
      "my-skill",
      "skill.json",
    );
    const meta = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    meta.llm.provider = "google";
    fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));
    expect(() => readSkill("my-skill")).toThrow(ValidationError);
  });
});

describe("readSkillForTarget", () => {
  it("returns SKILL.md as the only file", () => {
    writeSkill(baseInput);
    const target = readSkillForTarget("my-skill");
    expect(target.name).toBe("my-skill");
    expect(target.files).toHaveLength(1);
    expect(target.files[0].relPath).toBe("SKILL.md");
  });

  it("never exposes skill.json content", () => {
    writeSkill(baseInput);
    const target = readSkillForTarget("my-skill");
    for (const file of target.files) {
      expect(file.relPath).not.toBe("skill.json");
      expect(file.contents).not.toContain("schemaVersion");
      expect(file.contents).not.toContain("createdAt");
      expect(file.contents).not.toContain("anthropic");
    }
  });

  it("emits SKILL.md content that itself round-trips back to the same skill", () => {
    const tricky = "A description with: colons and \"quotes\".";
    writeSkill({ ...baseInput, description: tricky });
    const target = readSkillForTarget("my-skill");
    // Drop the synced copy back into a fresh skill dir and parse it.
    const altDir = path.join(tmpHome, ".skillsync", "skills", "alt-copy");
    fs.mkdirSync(altDir, { recursive: true });
    // Rewrite frontmatter name+metadata to 'alt-copy' so the consistency
    // check passes; the body and description must come through unchanged.
    const skillMd = target.files[0].contents.replace(
      "name: my-skill",
      "name: alt-copy",
    );
    fs.writeFileSync(path.join(altDir, "SKILL.md"), skillMd);
    fs.writeFileSync(
      path.join(altDir, "skill.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          name: "alt-copy",
          createdAt: new Date().toISOString(),
          llm: { provider: "anthropic", model: "claude-sonnet-4-6" },
        },
        null,
        2,
      ),
    );
    const reread = readSkill("alt-copy");
    expect(reread.description).toBe(tricky);
  });
});

describe("listSkills", () => {
  it("returns an empty array when nothing exists", () => {
    expect(listSkills()).toEqual([]);
  });

  it("returns all valid skills sorted by name", () => {
    writeSkill({ ...baseInput, name: "zebra" });
    writeSkill({ ...baseInput, name: "alpha" });
    writeSkill({ ...baseInput, name: "middle" });
    const names = listSkills().map((s) => s.name);
    expect(names).toEqual(["alpha", "middle", "zebra"]);
  });

  it("ignores directories whose name isn't a valid skill name", () => {
    writeSkill(baseInput);
    fs.mkdirSync(
      path.join(tmpHome, ".skillsync", "skills", ".tmp-leftover"),
      { recursive: true },
    );
    fs.mkdirSync(
      path.join(tmpHome, ".skillsync", "skills", "Bad_Name"),
      { recursive: true },
    );
    expect(listSkills().map((s) => s.name)).toEqual(["my-skill"]);
  });
});

describe("softDeleteSkill", () => {
  it("moves the canonical skill into trash with a timestamped suffix", () => {
    writeSkill(baseInput);
    const trashDir = softDeleteSkill("my-skill");
    expect(
      fs.existsSync(path.join(tmpHome, ".skillsync", "skills", "my-skill")),
    ).toBe(false);
    expect(fs.existsSync(trashDir)).toBe(true);
    expect(path.basename(trashDir)).toMatch(/^my-skill-/);
  });

  it("preserves contents in trash", () => {
    writeSkill(baseInput);
    const trashDir = softDeleteSkill("my-skill");
    expect(fs.existsSync(path.join(trashDir, "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(trashDir, "skill.json"))).toBe(true);
  });

  it("doesn't collide when the same name is deleted twice in the same millisecond", () => {
    writeSkill(baseInput);
    const first = softDeleteSkill("my-skill");
    writeSkill(baseInput);
    const second = softDeleteSkill("my-skill");
    expect(second).not.toBe(first);
    expect(fs.existsSync(first)).toBe(true);
    expect(fs.existsSync(second)).toBe(true);
  });

  it("throws when the skill doesn't exist", () => {
    expect(() => softDeleteSkill("ghost")).toThrow(/No skill named 'ghost'/);
  });

  it("rejects invalid skill names without touching the filesystem", () => {
    expect(() => softDeleteSkill("BAD")).toThrow(ValidationError);
  });
});
