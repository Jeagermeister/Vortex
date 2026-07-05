import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { makeModuleInstaller } = require("./moduleGameProfile");

const profile = {
  gameId: "mountandblade2bannerlord",
  moduleMarkerFiles: ["SubModule.xml"],
};

describe("module game profile installer", () => {
  it("supports archives containing the configured module marker", async () => {
    const { testSupported } = makeModuleInstaller(profile);

    await expect(
      testSupported(
        ["Harmony/SubModule.xml", "Harmony/bin/Win64_Shipping_Client/Harmony.dll"],
        profile.gameId,
      ),
    ).resolves.toEqual({
      supported: true,
      requiredFiles: [],
    });
  });

  it("rejects other games and archives without the module marker", async () => {
    const { testSupported } = makeModuleInstaller(profile);

    await expect(testSupported(["Harmony/readme.txt"], profile.gameId)).resolves.toEqual({
      supported: false,
      requiredFiles: [],
    });
    await expect(testSupported(["Harmony/SubModule.xml"], "skyrimse")).resolves.toEqual({
      supported: false,
      requiredFiles: [],
    });
  });

  it("copies only the detected module root into a module folder", async () => {
    const { install } = makeModuleInstaller(profile);

    const result = await install(
      [
        "archive wrapper/Harmony/SubModule.xml",
        "archive wrapper/Harmony/bin/Win64_Shipping_Client/Harmony.dll",
        "archive wrapper/Harmony/ModuleData/settings.xml",
        "archive wrapper/readme.txt",
        "archive wrapper/Harmony/",
        "archive wrapper/Harmony\\",
      ],
      "/tmp/Harmony-2.3.0",
    );

    expect(result.instructions).toEqual([
      {
        type: "copy",
        source: "archive wrapper/Harmony/SubModule.xml",
        destination: path.join("Harmony", "SubModule.xml"),
      },
      {
        type: "copy",
        source: "archive wrapper/Harmony/bin/Win64_Shipping_Client/Harmony.dll",
        destination: path.join("Harmony", "bin", "Win64_Shipping_Client", "Harmony.dll"),
      },
      {
        type: "copy",
        source: "archive wrapper/Harmony/ModuleData/settings.xml",
        destination: path.join("Harmony", "ModuleData", "settings.xml"),
      },
      {
        type: "attribute",
        key: "moduleName",
        value: "Harmony",
      },
    ]);
  });

  it("uses the destination archive name when the marker is at archive root", async () => {
    const { install } = makeModuleInstaller(profile);

    const result = await install(["SubModule.xml", "bin/Harmony.dll"], "/tmp/Harmony-2.3.0");

    expect(result.instructions).toContainEqual({
      type: "copy",
      source: "SubModule.xml",
      destination: path.join("Harmony-2.3.0", "SubModule.xml"),
    });
    expect(result.instructions).toContainEqual({
      type: "attribute",
      key: "moduleName",
      value: "Harmony-2.3.0",
    });
  });
});
