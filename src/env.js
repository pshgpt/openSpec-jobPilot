import { resolve } from "node:path";

/**
 * Load variables from a .env file, if there is one. A missing file is fine.
 * Variables already set in the environment are not overridden.
 *
 * @param {string} [path] Defaults to .env in the current working directory.
 * @returns {boolean} Whether a file was loaded.
 */
export function loadEnv(path = resolve(process.cwd(), ".env")) {
  try {
    process.loadEnvFile(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
