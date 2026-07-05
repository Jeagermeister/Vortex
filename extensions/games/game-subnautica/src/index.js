const path = require("path");

const { fs, util } = require("@nexusmods/vortex-api");

const GAME_ID = "subnautica";
const STEAM_ID = "264710";
const SUBNAUTICA_BEPINEX_PACK = {
  domainId: GAME_ID,
  gameId: GAME_ID,
  version: "5.4.23-pack.3.1.1",
  architecture: "x64",
  modId: 1108,
  fileId: 10667,
  archiveName: "Tobey's BepInEx Pack for Subnautica-1108-5-4-23-pack-3-1-1.zip",
  allowAutoInstall: true,
};

function findGame() {
  return util.steam.findByAppId(STEAM_ID).then((game) => game.gamePath);
}

function modPath() {
  return path.join("BepInEx", "plugins");
}

function prepareForModding(discovery) {
  return fs.ensureDirWritableAsync(path.join(discovery.path, modPath()));
}

function registerLinuxGame(context) {
  context.requireExtension("modtype-bepinex");

  context.registerGame({
    id: GAME_ID,
    executable: () => "Subnautica.exe",
    mergeMods: true,
    name: "Subnautica",
    queryPath: findGame,
    queryModPath: modPath,
    logo: "gameart.jpg",
    requiredFiles: ["Subnautica.exe"],
    setup: prepareForModding,
    environment: {
      SteamAPPId: STEAM_ID,
      WINEDLLOVERRIDES: "winhttp=n,b",
    },
    details: {
      steamAppId: Number(STEAM_ID),
      hashFiles: ["Subnautica.exe"],
    },
  });

  context.once(() => {
    if (context.api.ext.bepinexAddGame !== undefined) {
      context.api.ext.bepinexAddGame({
        gameId: GAME_ID,
        autoDownloadBepInEx: true,
        customPackDownloader: () => Promise.resolve(SUBNAUTICA_BEPINEX_PACK),
        doorstopConfig: {
          doorstopType: "default",
          ignoreDisableSwitch: true,
        },
      });
    }
  });
}

function registerStub(context) {
  context.registerGameStub(
    {
      id: GAME_ID,
      executable: null,
      mergeMods: false,
      name: "Subnautica",
      queryModPath: () => "QMods",
      requiredFiles: [],
    },
    {
      name: "Game: Subnautica",
      modId: 202,
    },
  );
}

function main(context) {
  if (process.platform === "linux") {
    registerLinuxGame(context);
  } else {
    registerStub(context);
  }
}

module.exports = {
  default: main,
};
