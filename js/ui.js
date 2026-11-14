// 頂欄與共用 UI 元素
import { el, avatarEl } from "./util.js";
import { state } from "./store.js";
import { sync, cloudConfigured } from "./sync.js";

export function renderTopbar({ title = "", back = null, left = null, right = [] } = {}) {
  const bar = document.getElementById("topbar");
  bar.innerHTML = "";
  bar.classList.remove("hidden");

  const sideL = el("div", { class: "topbar-side left" });
  if (back) {
    sideL.append(el("button", { class: "back-btn", onclick: back }, "‹ 返回"));
  } else if (left) {
    sideL.append(left);
  }

  const center = el("div", { class: "topbar-title" }, title);

  const sideR = el("div", { class: "topbar-side right" });
  for (const item of right) sideR.append(item);

  bar.append(sideL, center, sideR);
  return bar;
}

export function hideTopbar() {
  document.getElementById("topbar").classList.add("hidden");
}

export function timerChip() {
  const chip = el("span", { class: "timer-chip" }, "--:--");
  return chip;
}

export function themeToggleBtn() {
  const btn = el("button", { class: "icon-btn", "aria-label": "切換深色模式" });
  const paint = () => {
    const t = document.documentElement.dataset.theme;
    const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    btn.textContent = dark ? "🌙" : "☀️";
  };
  btn.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme === "dark" ||
      (document.documentElement.dataset.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    document.querySelector('meta[name="theme-color"]').content = dark ? "#17181c" : "#f6f6f9";
    paint();
  });
  paint();
  return btn;
}

// 同步狀態圓點 + 文案
export function syncBadge() {
  const dot = el("span", { class: "sync-dot" });
  const label = el("span", {});
  const paint = () => {
    if (!cloudConfigured) { dot.className = "sync-dot off"; label.textContent = "本機模式"; }
    else if (sync.session) { dot.className = "sync-dot"; label.textContent = "已同步"; }
    else { dot.className = "sync-dot off"; label.textContent = "未登入"; }
  };
  paint();
  return { dot, label, paint };
}

export function userAvatarBtn(onTap) {
  const btn = el("button", { class: "icon-btn", "aria-label": "使用者" });
  const paint = () => {
    btn.innerHTML = "";
    btn.append(avatarEl(state.profileName, state.profileColor));
  };
  paint();
  btn.addEventListener("click", onTap);
  return { btn, paint };
}
