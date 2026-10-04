import { execFileSync } from "node:child_process";
import { migrationSQL, readMigrations } from "../migrations.mjs";

// Fixed disposable container: no hosted database URL or credentials accepted.
execFileSync(
  "docker",
  [
    "exec",
    "-i",
    "tuktak-test-db-1",
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ],
  {
    input: migrationSQL(readMigrations(), { adoptInitial: true }),
    stdio: ["pipe", "ignore", "inherit"],
  },
);
console.log("Local migration chain is up to date.");
