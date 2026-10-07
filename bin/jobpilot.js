#!/usr/bin/env node
import { main } from "../src/cli.js";
import { loadEnv } from "../src/env.js";

loadEnv();
process.exitCode = await main(process.argv.slice(2));
