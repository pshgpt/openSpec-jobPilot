import { readFile as fsReadFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { analyze } from "./analyze.js";
import { AnalysisError, InputError } from "./errors.js";
import { createGeminiLlm } from "./llm.js";
import { renderJson, renderText } from "./report.js";

export const USAGE = `Usage: jobpilot analyze <resume> <job-description> [--json]

Compare a resume against a job description.

Arguments:
  resume           Path to the resume (UTF-8 plain text)
  job-description  Path to the job description (UTF-8 plain text)

Options:
  --json           Print the report as JSON
  -h, --help       Show this help
`;

const EXIT_ANALYSIS_FAILED = 1;
const EXIT_USAGE_OR_INPUT = 2;

/**
 * Run the CLI and return the exit code. Dependencies are injectable for tests.
 *
 * @param {string[]} argv
 * @param {object} [deps]
 */
export async function main(
  argv,
  { stdout = process.stdout, stderr = process.stderr, readFile = fsReadFile, createLlm = createGeminiLlm } = {},
) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (error) {
    stderr.write(`Error: ${error.message}\n\n${USAGE}`);
    return EXIT_USAGE_OR_INPUT;
  }

  if (parsed.values.help) {
    stdout.write(USAGE);
    return 0;
  }

  const [command, resumePath, jobDescriptionPath, ...extra] = parsed.positionals;
  if (command !== "analyze" || !resumePath || !jobDescriptionPath || extra.length > 0) {
    stderr.write(USAGE);
    return EXIT_USAGE_OR_INPUT;
  }

  let resume, jobDescription;
  try {
    resume = await readInput(readFile, resumePath, "resume");
    jobDescription = await readInput(readFile, jobDescriptionPath, "job description");
  } catch (error) {
    if (!(error instanceof InputError)) throw error;
    stderr.write(`Error: ${error.message}\n`);
    return EXIT_USAGE_OR_INPUT;
  }

  let report;
  try {
    const onWarning = (message) => stderr.write(`Warning: ${message}\n`);
    report = await analyze({ llm: createLlm(), resume, jobDescription, onWarning });
  } catch (error) {
    if (!(error instanceof AnalysisError)) throw error;
    stderr.write(`Error: ${error.message}\n`);
    return EXIT_ANALYSIS_FAILED;
  }

  // Rendered in full before writing, so a failure never leaves a partial report.
  stdout.write(parsed.values.json ? renderJson(report) : renderText(report));
  return 0;
}

/** Read a UTF-8 text file, or throw an InputError naming the file. */
async function readInput(readFile, path, label) {
  let bytes;
  try {
    bytes = await readFile(path);
  } catch (error) {
    if (error.code === "ENOENT") throw new InputError(`${label} file not found: ${path}`);
    throw new InputError(`could not read ${label} file ${path}: ${error.message}`);
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new InputError(`${label} file ${path} is not valid UTF-8 text`);
  }

  if (text.trim() === "") throw new InputError(`${label} file ${path} is empty`);
  return text;
}
