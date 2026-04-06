#!/usr/bin/env node

import { Command } from "commander";
import { registerNew } from "./commands/new.js";
import { registerSync } from "./commands/sync.js";
import { registerDelete } from "./commands/delete.js";
import { registerList } from "./commands/list.js";

const program = new Command();

program
  .name("skillsync")
  .description("Author an agent skill once, sync it to every agent CLI")
  .version("0.1.0");

registerNew(program);
registerSync(program);
registerDelete(program);
registerList(program);

program.parse();
