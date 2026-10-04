import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, expect, it } from "vitest";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "tuktak-startup-"));
  mkdirSync(join(directory, "bin"));
  // Exercise the real shell orchestration without starting services in a unit
  // test. Full CI/browser validation still uses actual PostgreSQL and Auth.
  const stubs: Record<string, string> = {
    docker: `#!/bin/bash
printf '%s\\n' "$*" >> "$STARTUP_TEST_LOG"
case "$*" in
  *"select 1 from pg_roles"*)
    if [ "$STARTUP_TEST_DB_FAILURE" = 1 ]; then echo 'Catalog query rejected' >&2; exit 3; fi
    echo 1 ;;
  *"select coalesce(to_regclass"*) echo profiles ;;
  *"exec -i"*) echo 'Unexpected bootstrap of existing database' >&2; exit 3 ;;
esac
`,
    curl: "#!/bin/bash\nexit 0\n",
    node: "#!/bin/bash\nexit 0\n",
    rg: "#!/bin/bash\necho 'Unexpected ripgrep dependency' >&2\nexit 127\n",
  };
  for (const [name, body] of Object.entries(stubs))
    writeFileSync(join(directory, "bin", name), body, { mode: 0o700 });
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function start(failDatabaseQuery = false) {
  return spawnSync("/bin/bash", ["scripts/local/start.sh"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${join(directory, "bin")}:${process.env.PATH}`,
      STARTUP_TEST_LOG: join(directory, "commands.log"),
      STARTUP_TEST_DB_FAILURE: failDatabaseQuery ? "1" : "0",
    },
    encoding: "utf8",
  });
}

it("starts an existing local database without ripgrep or re-bootstrapping/seeding", () => {
  const result = start();
  expect(result.status).toBe(0);
  expect(result.stderr).not.toContain("Unexpected");
  expect(readFileSync(join(directory, "commands.log"), "utf8")).not.toContain(
    "exec -i",
  );
});

it("stops on a failed role catalog query instead of treating it as a missing role", () => {
  const result = start(true);
  expect(result.status).toBe(3);
  expect(result.stderr).toContain("Catalog query rejected");
  expect(readFileSync(join(directory, "commands.log"), "utf8")).not.toContain(
    "exec -i",
  );
});
