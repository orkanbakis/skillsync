import type { Command } from "commander";

export function registerSync(program: Command): void {
  program
    .command("sync")
    .description("Sync skills to all detected agent CLIs")
    .argument("[name]", "skill name to sync (default: all)")
    .action((name?: string) => {
      console.log(`skillsync sync${name ? ` ${name}` : ""} — not implemented`);
      process.exit(1);
    });
}
