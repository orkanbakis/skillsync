import type { Command } from "commander";

export function registerList(program: Command): void {
  program
    .command("list")
    .description("List canonical skills and their sync status")
    .action(() => {
      console.log("skillsync list — not implemented");
      process.exit(1);
    });
}
