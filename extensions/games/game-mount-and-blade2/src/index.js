const path = require("path");
const { registerModuleGameProfile } = require("./moduleGameProfile");

const GAME_ID = "mountandblade2bannerlord";
const STEAMAPP_ID = "261550";

const BANNERLORD_PROFILE = {
  gameId: GAME_ID,
  name: "Mount & Blade II:\tBannerlord",
  steamAppId: STEAMAPP_ID,
  logo: "gameart.jpg",
  modulePath: "Modules",
  moduleMarkerFiles: ["SubModule.xml"],
  executable: path.join("bin", "Win64_Shipping_Client", "Bannerlord.exe"),
  requiredFiles: [
    path.join("bin", "Win64_Shipping_Client", "Bannerlord.exe"),
    path.join("Modules", "Native", "SubModule.xml"),
  ],
};

function main(context) {
  if (process.platform === "linux") {
    registerModuleGameProfile(context, BANNERLORD_PROFILE);
    return true;
  }

  context.registerGameStub(
    {
      id: GAME_ID,
      executable: null,
      mergeMods: false,
      name: "Mount & Blade II:\tBannerlord",
      queryModPath: () => ".",
      requiredFiles: [],
    },
    {
      name: "Mount and Blade II Bannerlord Vortex Support",
      modId: 875,
    },
  );

  return true;
}

module.exports = {
  default: main,
};
