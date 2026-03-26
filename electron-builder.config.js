/**
 * @type {import('electron-builder').Configuration}
 */
export default {
  appId: "com.nodetrans.app",
  productName: "Node Trans",
  directories: {
    output: "release",
    buildResources: "build",
  },
  files: [
    "dist/**/*",
    "src/**/*",
    "electron/**/*",
    "package.json",
    "!node_modules/**/{test,tests,__tests__,spec,specs}/**",
    "!node_modules/**/*.map",
    "!node_modules/**/*.ts",
    "!node_modules/**/*.d.ts",
    "!node_modules/**/README*",
    "!node_modules/**/CHANGELOG*",
    "!node_modules/**/LICENSE*",
    "!node_modules/**/{example,examples,doc,docs}/**",
    "!node_modules/**/.eslint*",
    "!node_modules/**/.prettier*",
    "!node_modules/**/{.github,.vscode}/**",
  ],
  asarUnpack: ["**/better-sqlite3/**"],
  extraResources: [
    {
      from: "ffmpeg-bin/${os}",
      to: "ffmpeg",
      filter: ["**/*"],
    },
  ],
  icon: "build/icon",
  mac: {
    target: ["dir", "zip"],
    category: "public.app-category.productivity",
    hardenedRuntime: true,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    extendInfo: {
      NSMicrophoneUsageDescription:
        "Node Trans needs microphone access to capture and translate audio.",
    },
  },
  win: {
    target: ["nsis", "portable"],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};
