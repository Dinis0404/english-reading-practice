// 資料層：設定、使用者（訪客檔案 / 雲端帳號）、作答記錄、題庫載入
import { sync } from "./sync.js";

const LS = {
  settings: "erp_settings",
  profiles: "erp_profiles",
  current: "erp_current_profile",
  dataPrefix: "erp_data_",   // + profileId
  cloudPrefix: "erp_cloud_", // + userId
};

// ---- 題庫載入 ----
let manifestCache = null;
const setCache = new Map();

export async function loadManifest() {
  if (!manifestCache) {
    manifestCache = await (await fetch("data/manifest.json", { cache: "no-cache" })).json();
  }
  return manifestCache;
}

export async function loadSet(type, id) {
  const key = type + "/" + id;
  if (!setCache.has(key)) {
    const res = await fetch(`data/${type}/${id}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error("找不到題組 " + key);
    setCache.set(key, await res.json());
  }
  return setCache.get(key);
}

// ---- 設定 ----
export const settings = {
  theme: "auto", // auto | light | dark
};

export function loadSettings() {
  try { Object.assign(settings, JSON.parse(localStorage.getItem(LS.settings) || "{}")); } catch {}
}
export function saveSettings() {
  localStorage.setItem(LS.settings, JSON.stringify(settings));
  applyTheme();
}
export function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
  const dark = settings.theme === "dark" ||
    (settings.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? "#17181c" : "#f6f6f9";
}

// ---- 身分狀態 ----
// mode: "guest"（本機檔案）| "cloud"（Supabase 帳號）| null（未選擇）
export const state = {
  mode: null,
  profileId: null,   // guest 檔案 id 或雲端 user id
  profileName: "",
  profileColor: "#5b7ce0",
};

// ---- 訪客檔案 ----
export function listGuestProfiles() {
  try { return JSON.parse(localStorage.getItem(LS.profiles) || "[]"); } catch { return []; }
}
function saveGuestProfiles(list) {
  localStorage.setItem(LS.profiles, JSON.stringify(list));
}
export function createGuestProfile(name, pinHash = null) {
  const list = listGuestProfiles();
  const id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const colors = ["#5b7ce0", "#e07b54", "#3f9d7a", "#b06ad0", "#d95f8e", "#5aa3d8", "#c2a04a", "#7a8ce0"];
  list.push({ id, name, color: colors[list.length % colors.length], pinHash, createdAt: new Date().toISOString() });
  saveGuestProfiles(list);
  return list[list.length - 1];
}

// ---- 記錄存取 ----
function dataKey() {
  return (state.mode === "cloud" ? LS.cloudPrefix : LS.dataPrefix) + (state.profileId || "anon");
}

export function getAttempts() {
  try { return JSON.parse(localStorage.getItem(dataKey()) || "[]"); } catch { return []; }
}
function saveAttempts(list) {
  localStorage.setItem(dataKey(), JSON.stringify(list.slice(-300)));
}

export function saveAttempt(attempt) {
  attempt.synced = false;
  const list = getAttempts().filter((a) => a.key !== attempt.key);
  list.push(attempt);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  saveAttempts(list);
  if (state.mode === "cloud" && sync.client) sync.pushPending();
  return attempt;
}

export function getAttempt(key) {
  return getAttempts().find((a) => a.key === key) || null;
}

export function clearLocalHistory() {
  saveAttempts([]);
}

// 合併雲端拉回的記錄（以 set + createdAt 去重）
export function mergeRemoteAttempts(remoteList) {
  const local = getAttempts();
  const seen = new Set(local.map((a) => a.setId + "#" + a.createdAt));
  let added = 0;
  for (const r of remoteList) {
    if (seen.has(r.setId + "#" + r.createdAt)) continue;
    local.push({ ...r, synced: true });
    added++;
  }
  local.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  saveAttempts(local);
  return added;
}

// 標記為已同步
export function markSynced(keys) {
  const list = getAttempts();
  for (const a of list) if (keys.has(a.key)) a.synced = true;
  saveAttempts(list);
}

// ---- 新作答記錄 ----
export function makeAttempt(setData, answers, { timeSpent, timedOut, timed }) {
  const score = setData.questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
  return {
    key: setData.id + "#" + Date.now().toString(36),
    setId: setData.id,
    setType: setData.type,
    title: setData.title,
    score,
    total: setData.questions.length,
    answers: answers.map((a) => (a === null ? -1 : a)),
    timeSpent,
    timedOut: !!timedOut,
    timed: !!timed,
    createdAt: new Date().toISOString(),
  };
}

// ---- 進入/離開使用者 ----
export function enterGuest(profile) {
  state.mode = "guest";
  state.profileId = profile.id;
  state.profileName = profile.name;
  state.profileColor = profile.color;
  localStorage.setItem(LS.current, profile.id);
}
export async function enterCloudUser(userId, name) {
  state.mode = "cloud";
  state.profileId = userId;
  state.profileName = name || "學習者";
  state.profileColor = "#5b7ce0";
  localStorage.setItem(LS.current, "cloud:" + userId);
}

export function restoreSession() {
  const cur = localStorage.getItem(LS.current);
  if (cur && !cur.startsWith("cloud:")) {
    const p = listGuestProfiles().find((x) => x.id === cur);
    if (p) { enterGuest(p); return true; }
  }
  return false;
}

export function switchToGate() {
  localStorage.removeItem(LS.current);
  state.mode = null;
  state.profileId = null;
}

// ---- 統計輔助 ----
export function bestScoreOf(setId) {
  let best = null;
  for (const a of getAttempts()) {
    if (a.setId !== setId) continue;
    const pct = a.score / a.total;
    if (!best || pct > best.score / best.total) best = a;
  }
  return best;
}
export function attemptCountOf(setId) {
  return getAttempts().filter((a) => a.setId === setId).length;
}
