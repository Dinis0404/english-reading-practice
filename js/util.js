// 通用工具函式
export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---- 計時格式 ----
export function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function fmtDuration(sec) {
  sec = Math.round(sec);
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s ? `${m} 分 ${s} 秒` : `${m} 分`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- Toast ----
let toastTimer = null;
export function toast(msg, ms = 2200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), ms);
}

// ---- 模態對話框 ----
export function modal({ title, body, actions }) {
  const root = $("#modal");
  $("#modal-title").textContent = title;
  const bodyEl = $("#modal-body");
  bodyEl.innerHTML = "";
  if (typeof body === "string") bodyEl.innerHTML = body;
  else if (body) bodyEl.append(body);
  const actEl = $("#modal-actions");
  actEl.innerHTML = "";
  for (const a of actions || []) {
    actEl.append(el("button", {
      class: "btn " + (a.kind || "secondary"),
      onclick: () => {
        if (a.dismissable !== false) closeModal();
        a.fn && a.fn(closeModal);
      },
    }, a.label));
  }
  root.classList.remove("hidden");
  $(".modal-mask", root).onclick = () => {
    if (actions?.every((a) => a.dismissable !== false) || !actions) closeModal();
  };
}
export function closeModal() { $("#modal").classList.add("hidden"); }

export function confirmDialog(title, body, okLabel = "確定", onOk, danger = false) {
  modal({
    title, body,
    actions: [
      { label: "取消", kind: "secondary" },
      { label: okLabel, kind: danger ? "danger" : "", fn: onOk },
    ],
  });
}

// ---- 雜項 ----
export const COLORS = ["#5b7ce0", "#e07b54", "#3f9d7a", "#b06ad0", "#d95f8e", "#5aa3d8", "#c2a04a", "#7a8ce0"];
export function colorFor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function avatarEl(name, color, big = false) {
  return el("span", { class: "avatar" + (big ? " big" : ""), style: `background:${color}` },
    (name || "?").trim().charAt(0).toUpperCase() || "?");
}

// 4 位數 PIN 的雜湊（SHA-256）
export async function hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("erp:" + pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
