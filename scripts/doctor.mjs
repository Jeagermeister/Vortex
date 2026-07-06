import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const expectedNode = readFileSync(path.join(root, ".node-version"), "utf8").trim();
const expectedPnpm = packageJson.devEngines?.packageManager?.version ?? "unknown";

const checks = [];

function run(command, args = []) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  return {
    ok: result.status === 0,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    error: result.error,
  };
}

function add(status, name, detail, hint) {
  checks.push({ status, name, detail, hint });
}

function pass(name, detail) {
  add("PASS", name, detail);
}

function warn(name, detail, hint) {
  add("WARN", name, detail, hint);
}

function fail(name, detail, hint) {
  add("FAIL", name, detail, hint);
}

function versionTuple(value) {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(value);
  if (!match) return undefined;
  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

function isAtLeast(actual, expected) {
  const lhs = versionTuple(actual);
  const rhs = versionTuple(expected);
  if (!lhs || !rhs) return false;

  for (let i = 0; i < rhs.length; i++) {
    if (lhs[i] > rhs[i]) return true;
    if (lhs[i] < rhs[i]) return false;
  }
  return true;
}

function commandVersion(command, args, label) {
  const result = run(command, args);
  if (result.error) {
    fail(
      label,
      `could not execute (${result.error.code ?? "unknown error"})`,
      `Check that ${label} is executable from this shell.`,
    );
    return undefined;
  }

  if (!result.ok) {
    fail(label, "not found", `Install ${label} and make sure it is on PATH.`);
    return undefined;
  }
  return result.stdout.split("\n")[0] ?? "";
}

function checkNode() {
  const actual = process.version.replace(/^v/, "");
  if (isAtLeast(actual, expectedNode)) {
    pass("Node.js", `${actual} (baseline ${expectedNode})`);
  } else {
    fail("Node.js", `${actual} is older than ${expectedNode}`, "Install the repo baseline Node.");
  }
}

function checkPnpm() {
  const actual = commandVersion("pnpm", ["--version"], "pnpm");
  if (!actual) return;

  if (actual === expectedPnpm) {
    pass("pnpm", actual);
  } else {
    warn(
      "pnpm",
      `${actual} (repo pins ${expectedPnpm})`,
      "Use Corepack or run with pnpm_config_pm_on_fail=ignore until pnpm is aligned.",
    );
  }
}

function checkDotnet() {
  const sdks = run("dotnet", ["--list-sdks"]);
  if (!sdks.ok) {
    fail(".NET SDK", "dotnet not found", "Install dotnet-sdk-9.0.");
    return;
  }

  const hasSdk9 = sdks.stdout.split("\n").some((line) => /^9\./.test(line.trim()));
  if (!hasSdk9) {
    fail(".NET SDK", sdks.stdout || "no SDKs listed", "Install .NET SDK 9.x.");
    return;
  }

  const current = run("dotnet", ["--version"]).stdout || "unknown";
  pass(".NET SDK", `9.x available; default ${current}`);
}

function checkPython() {
  const python = commandVersion("python3", ["--version"], "python3");
  if (!python) return;

  const setuptools = run("python3", ["-c", "import setuptools; print(setuptools.__version__)"]);
  if (setuptools.ok) {
    pass("python setuptools", setuptools.stdout);
  } else {
    warn(
      "python setuptools",
      "not importable",
      "Install python-setuptools; node-gyp may need it on Python 3.12+.",
    );
  }
}

function checkNativeToolchain() {
  const gcc = commandVersion("gcc", ["--version"], "gcc");
  if (gcc) pass("gcc", gcc);

  const make = commandVersion("make", ["--version"], "make");
  if (make) pass("make", make);
}

function steamCandidates() {
  const home = homedir();
  return [
    path.join(home, ".local", "share", "Steam"),
    path.join(home, ".steam", "debian-installation"),
    path.join(home, ".var", "app", "com.valvesoftware.Steam", "data", "Steam"),
    path.join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam"),
    path.join(home, "snap", "steam", "common", ".local", "share", "Steam"),
    path.join(home, ".steam", "steam"),
  ];
}

function validSteamPath(steamPath) {
  return existsSync(path.join(steamPath, "config", "libraryfolders.vdf"));
}

function findProtonTools(steamPath) {
  const dirs = [
    path.join(steamPath, "steamapps", "common"),
    path.join(steamPath, "compatibilitytools.d"),
  ];
  const found = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      if (/proton/i.test(entry)) found.push(full);
    }
  }

  return found;
}

function checkSteam() {
  const steamPath = steamCandidates().find(validSteamPath);
  if (!steamPath) {
    warn(
      "Steam",
      "not found in common Linux locations",
      "Install Steam or add a future custom path.",
    );
    return;
  }

  pass("Steam", steamPath);
  const protonTools = findProtonTools(steamPath);
  if (protonTools.length === 0) {
    warn("Proton tools", "none found", "Install or launch a Windows Steam game once.");
  } else {
    pass("Proton tools", `${protonTools.length} found`);
  }
}

function checkElectronSandbox() {
  const sandboxPath = path.join(root, "node_modules", "electron", "dist", "chrome-sandbox");
  if (!existsSync(sandboxPath)) {
    warn("Electron sandbox", "chrome-sandbox not found yet", "Run pnpm install first.");
    return;
  }

  const mode = statSync(sandboxPath).mode & 0o7777;
  if (mode === 0o4755) {
    pass("Electron sandbox", "chrome-sandbox mode is 4755");
  } else {
    warn(
      "Electron sandbox",
      `chrome-sandbox mode is ${mode.toString(8)}`,
      "Local dev protocol handlers may need --no-sandbox unless the helper is configured.",
    );
  }
}

checkNode();
checkPnpm();
checkDotnet();
checkPython();
checkNativeToolchain();
checkSteam();
checkElectronSandbox();

const order = { FAIL: 0, WARN: 1, PASS: 2 };
for (const check of checks.sort((a, b) => order[a.status] - order[b.status])) {
  console.log(`${check.status.padEnd(4)} ${check.name}: ${check.detail}`);
  if (check.hint) console.log(`     ${check.hint}`);
}

const failures = checks.filter((check) => check.status === "FAIL").length;
if (failures > 0) {
  console.error(`\n${failures} required check(s) failed.`);
  process.exit(1);
}

console.log("\nEnvironment doctor completed.");
