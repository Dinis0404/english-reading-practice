// 路由與啟動
import { applyTheme, loadSettings, state, restoreSession, enterCloudUser, switchToGate } from "./store.js";
import { sync, cloudConfigured } from "./sync.js";
import { renderGate } from "./views/gate.js";
import { renderHome } from "./views/home.js";
import { renderRun } from "./views/run.js";
import { renderReview } from "./views/review.js";
import { renderHistory } from "./views/history.js";
import { renderSettings } from "./views/settings.js";
import { renderVocab, renderVocabFlash, renderVocabQuiz, renderVocabList } from "./views/vocab.js";
import { toast } from "./util.js";

const ctx = {
  go(hash) { location.hash = hash; },
  _leaveFns: [],
  onLeave(fn) { this._leaveFns.push(fn); },
};

let currentRoute = "";

async function route() {
  const hash = location.hash || "#/";
  if (hash === currentRoute) return;
  currentRoute = hash;

  // 執行上一頁的清理
  for (const fn of ctx._leaveFns) { try { fn(); } catch {} }
  ctx._leaveFns = [];

  // 需要使用者身分的頁面
  const needsUser = !["#/", ""].includes(hash);
  if (needsUser && !state.profileId) {
    location.hash = "#/";
    return;
  }

  const parts = hash.replace(/^#\//, "").split("/").filter(Boolean);
  try {
    if (parts.length === 0) {
      renderGate(ctx);
    } else if (parts[0] === "home") {
      await renderHome(ctx);
    } else if (parts[0] === "run" && parts[1] && parts[2]) {
      await renderRun(ctx, parts[1], parts[2]);
    } else if (parts[0] === "review" && parts[1] && parts[2] && parts[3]) {
      await renderReview(ctx, parts[1], parts[2], decodeURIComponent(parts[3]));
    } else if (parts[0] === "history") {
      await renderHistory(ctx);
    } else if (parts[0] === "vocab") {
      if (parts[1] === "flash") await renderVocabFlash(ctx, parts[2] || "w1");
      else if (parts[1] === "quiz") await renderVocabQuiz(ctx, parts[2] || "w1");
      else if (parts[1] === "list") await renderVocabList(ctx, parts[2] || "w1");
      else await renderVocab(ctx);
    } else if (parts[0] === "settings") {
      renderSettings(ctx);
    } else {
      location.hash = "#/";
    }
  } catch (e) {
    console.error(e);
    toast("載入失敗：" + (e.message || e));
    location.hash = "#/home";
  }
}

window.addEventListener("hashchange", route);

async function boot() {
  loadSettings();
  applyTheme();
  await sync.init();

  // 離線支援（僅正式部署環境註冊，本地開發不註冊以免緩存干擾）
  if ("serviceWorker" in navigator && location.protocol === "https:" &&
      !["localhost", "127.0.0.1"].includes(location.hostname)) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  // 雲端會話恢復
  if (cloudConfigured && sync.session) {
    const name = await sync.getDisplayName();
    await enterCloudUser(sync.session.user.id, name);
    sync.pull().catch(() => {});
  } else {
    restoreSession();
  }

  if (!location.hash) location.hash = state.profileId ? "#/home" : "#/";
  route();
}

boot();
