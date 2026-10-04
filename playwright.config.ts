import { defineConfig, devices } from "@playwright/test";
import chromium from "@sparticuz/chromium";
const localBinary = process.env.PLAYWRIGHT_USE_PACKAGED_CHROMIUM === "1";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: localBinary
      ? {
          executablePath: await chromium.executablePath(),
          args: chromium.args.filter(
            (a) =>
              ![
                "--single-process",
                "--disable-web-security",
                "--allow-running-insecure-content",
              ].includes(a),
          ),
        }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
