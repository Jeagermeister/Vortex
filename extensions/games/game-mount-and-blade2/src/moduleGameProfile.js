const path = require("path");

function vortexApi() {
  return require("@nexusmods/vortex-api");
}

function archivePath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

function archiveParts(filePath) {
  return archivePath(filePath).split("/").filter(Boolean);
}

function isDirectoryEntry(filePath) {
  return /[\\/]$/.test(filePath);
}

function archiveBasename(filePath) {
  const parts = archiveParts(filePath);
  return parts[parts.length - 1] || "";
}

function archiveDirname(filePath) {
  const parts = archiveParts(filePath);
  parts.pop();
  return parts.join("/");
}

function archiveRelative(rootPath, filePath) {
  const rootParts = archiveParts(rootPath);
  return archiveParts(filePath).slice(rootParts.length).join(path.sep);
}

function archiveStartsWith(rootPath, filePath) {
  const rootParts = archiveParts(rootPath);
  const fileParts = archiveParts(filePath);

  if (rootParts.length === 0) {
    return true;
  }

  if (fileParts.length < rootParts.length) {
    return false;
  }

  return rootParts.every((part, idx) => part === fileParts[idx]);
}

function findMarker(files, markerFiles) {
  const normalizedMarkers = markerFiles.map((marker) => marker.toLowerCase());

  return files.find((file) => {
    if (isDirectoryEntry(file)) {
      return false;
    }

    return normalizedMarkers.includes(archiveBasename(file).toLowerCase());
  });
}

function fallbackModuleName(destinationPath) {
  return path
    .basename(destinationPath)
    .replace(/\.installing$/i, "")
    .replace(/\.(7z|zip|rar|tar|gz|bz2|xz)$/i, "");
}

function moduleNameFromRoot(moduleRoot, destinationPath) {
  const rootName = archiveBasename(moduleRoot);
  return rootName !== "" ? rootName : fallbackModuleName(destinationPath);
}

function moduleInstructions(files, markerFile, destinationPath) {
  const moduleRoot = archiveDirname(markerFile);
  const moduleName = moduleNameFromRoot(moduleRoot, destinationPath);

  const instructions = files
    .filter((file) => !isDirectoryEntry(file))
    .filter((file) => archiveStartsWith(moduleRoot, file))
    .map((file) => {
      const relativePath = archiveRelative(moduleRoot, file);
      return {
        type: "copy",
        source: file,
        destination: path.join(moduleName, relativePath),
      };
    })
    .filter((instruction) => instruction.destination !== moduleName);

  instructions.push({
    type: "attribute",
    key: "moduleName",
    value: moduleName,
  });

  return instructions;
}

function findGameBySteamAppId(steamAppId) {
  const { util } = vortexApi();
  return util.steam.findByAppId(steamAppId.toString()).then((game) => game.gamePath);
}

function prepareModulePath(discovery, modulePath) {
  const { fs } = vortexApi();
  return fs.ensureDirAsync(path.join(discovery.path, modulePath));
}

function makeModuleInstaller(profile) {
  const testSupported = (files, gameId) => {
    const supported =
      gameId === profile.gameId && findMarker(files, profile.moduleMarkerFiles) !== undefined;
    return Promise.resolve({
      supported,
      requiredFiles: [],
    });
  };

  const install = (files, destinationPath) => {
    const markerFile = findMarker(files, profile.moduleMarkerFiles);
    if (markerFile === undefined) {
      return Promise.resolve({ instructions: [] });
    }

    return Promise.resolve({
      instructions: moduleInstructions(files, markerFile, destinationPath),
    });
  };

  return { testSupported, install };
}

function registerModuleGameProfile(context, profile) {
  const { testSupported, install } = makeModuleInstaller(profile);
  const steamAppId = profile.steamAppId.toString();

  context.registerGame({
    id: profile.gameId,
    name: profile.name,
    mergeMods: true,
    queryPath: profile.queryPath || (() => findGameBySteamAppId(steamAppId)),
    queryModPath: () => profile.modulePath,
    logo: profile.logo,
    executable: () => profile.executable,
    requiredFiles: profile.requiredFiles || [profile.executable],
    setup: (discovery) => prepareModulePath(discovery, profile.modulePath),
    environment: {
      SteamAPPId: steamAppId,
    },
    details: {
      steamAppId: Number.parseInt(steamAppId, 10),
    },
  });

  context.registerInstaller(
    profile.installerId || `${profile.gameId}-module-installer`,
    profile.installerPriority || 25,
    testSupported,
    install,
  );
}

module.exports = {
  makeModuleInstaller,
  registerModuleGameProfile,
};
