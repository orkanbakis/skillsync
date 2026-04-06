import type { Command } from "commander";

export function registerNew(program: Command): void {
  program
    .command("new")
    .description("Create a new skill via LLM-guided conversation")
    .action(() => {
      console.log("skillsync new — not implemented");
      process.exit(1);
    });
}
