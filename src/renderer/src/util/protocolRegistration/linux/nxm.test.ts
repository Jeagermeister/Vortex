import * as fs from "fs-extra";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  devElectronSandboxArgs,
  generateWrapperScript,
  isElectronSandboxHelperConfigured,
} from "./nxm";

vi.mock("fs-extra", () => ({
  statSync: vi.fn(),
}));

const statSyncMock = vi.mocked(fs.statSync);

describe("Linux nxm protocol registration", () => {
  beforeEach(() => {
    statSyncMock.mockReset();
  });

  describe("isElectronSandboxHelperConfigured", () => {
    test("accepts a root-owned setuid sandbox helper", () => {
      statSyncMock.mockReturnValue({ mode: 0o4755, uid: 0 } as fs.Stats);

      expect(isElectronSandboxHelperConfigured("/opt/electron/electron")).toBe(true);
    });

    test("rejects a user-owned sandbox helper", () => {
      statSyncMock.mockReturnValue({ mode: 0o755, uid: 1000 } as fs.Stats);

      expect(isElectronSandboxHelperConfigured("/home/user/vortex/electron")).toBe(false);
    });

    test("rejects a missing sandbox helper", () => {
      const error = Object.assign(new Error("missing"), { code: "ENOENT" });
      statSyncMock.mockImplementation(() => {
        throw error;
      });

      expect(isElectronSandboxHelperConfigured("/home/user/vortex/electron")).toBe(false);
    });
  });

  describe("devElectronSandboxArgs", () => {
    test("adds --no-sandbox when the helper is not configured", () => {
      statSyncMock.mockReturnValue({ mode: 0o755, uid: 1000 } as fs.Stats);

      expect(devElectronSandboxArgs("/home/user/vortex/electron")).toEqual(["--no-sandbox"]);
    });

    test("keeps the sandbox enabled when the helper is configured", () => {
      statSyncMock.mockReturnValue({ mode: 0o4755, uid: 0 } as fs.Stats);

      expect(devElectronSandboxArgs("/opt/electron/electron")).toEqual([]);
    });
  });

  describe("generateWrapperScript", () => {
    test("passes --no-sandbox before the app path when needed", () => {
      statSyncMock.mockReturnValue({ mode: 0o755, uid: 1000 } as fs.Stats);

      const script = generateWrapperScript("/home/user/vortex/electron", "/home/user/vortex/app");

      expect(script).toContain("unset ELECTRON_RUN_AS_NODE");
      expect(script).toContain("unset ELECTRON_NO_ATTACH_CONSOLE");
      expect(script).toContain(
        'exec "/home/user/vortex/electron" "--no-sandbox" "/home/user/vortex/app" --download "$@"',
      );
      expect(script).toContain(
        'exec "/home/user/vortex/electron" "--no-sandbox" "/home/user/vortex/app"',
      );
    });

    test("omits --no-sandbox when the helper is configured", () => {
      statSyncMock.mockReturnValue({ mode: 0o4755, uid: 0 } as fs.Stats);

      const script = generateWrapperScript("/opt/electron/electron", "/opt/vortex/app");

      expect(script).toContain('exec "/opt/electron/electron" "/opt/vortex/app" --download "$@"');
      expect(script).not.toContain("--no-sandbox");
    });
  });
});
