import { execSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

/**
 * 原生(Capacitor)构建：
 *  1. 临时移走 app/api（动态 Route Handler 与 output:'export' 不兼容；原生端也不需要代理）
 *  2. BUILD_TARGET=native next build → 纯静态导出到 out/
 *  3. 恢复 app/api（dev/web 仍可用代理）
 *  4. 若已添加 android 平台则 cap sync
 */
const API_DIR = "app/api";
const API_STASH = ".api-stash";

function run(cmd, extraEnv = {}) {
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
}

let stashed = false;
try {
  if (existsSync(API_DIR)) {
    renameSync(API_DIR, API_STASH);
    stashed = true;
  }
  run("npx next build", { BUILD_TARGET: "native" });
} finally {
  if (stashed && existsSync(API_STASH)) {
    renameSync(API_STASH, API_DIR);
  }
}

if (existsSync("android")) {
  run("npx cap sync android");
} else {
  console.log(
    "\n[build-native] 未检测到 android 平台，已跳过 cap sync。\n" +
      "首次请先运行: npx cap add android，然后重跑 npm run build:native\n"
  );
}
