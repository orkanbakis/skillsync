import type { Command } from "commander";

export function registerDelete(program: Command): void {
  program
    .command("delete")
    .description("Delete a canonical skill (soft-delete to trash)")
    .argument("<name>", "skill name to delete")
    .option("--prune", "also remove synced copies from target directories")
    .action((name: string, opts: { prune?: boolean }) => {
      console.log(
        `skillsync delete ${name}${opts.prune ? " --prune" : ""} — not implemented`,
      );
      process.exit(1);
    });
}
