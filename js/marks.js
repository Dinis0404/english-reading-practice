// 手寫記號：在文章上手寫/畫線/螢光筆（Apple Pencil 或手指）
// 雙畫布：baseCanvas 已提交筆跡 + liveCanvas 當前筆跡（單一 alpha，避免螢光筆重疊變深）
// 座標正規化（0-1），轉向/縮放時按比例重繪；按「使用者 + 題組」持久化。
import { el, toast } from "./util.js";
import { state } from "./store.js";

const TOOLS = [
  { id: "pen-red", tool: "pen", color: "#e0424b" },
  { id: "pen-blue", tool: "pen", color: "#2f6bd6" },
  { id: "pen-dark", tool: "pen", color: "#343a46" },
  { id: "hl-yellow", tool: "hl", color: "#ffd23e" },
  { id: "hl-green", tool: "hl", color: "#7ddc8f" },
];
const PEN_W = 2.5, HL_W = 16;
const MAX_STROKES = 300;

function storageKey(setId) {
  return `erp_marks__${state.mode || "anon"}_${state.profileId || "anon"}__${setId}`;
}

export function attachMarks({ paneEl, scrollEl, contentEl, setId }) {
  const ctrl = { destroy };

  // ---- 包裹層：內容 + 畫布 ----
  const wrap = el("div", { class: "mark-wrap" });
  contentEl.parentNode.insertBefore(wrap, contentEl);
  wrap.append(contentEl);

  const baseCanvas = el("canvas", { class: "mark-canvas" });
  const liveCanvas = el("canvas", { class: "mark-canvas live" });
  wrap.append(baseCanvas, liveCanvas);

  // ---- 狀態 ----
  let strokes = [];
  let active = false;
  let pencilOnly = false;
  let currentTool = TOOLS[0];
  let drawing = null; // 進行中的筆跡
  let ro = null;

  // ---- 持久化 ----
  function load() {
    try {
      const raw = localStorage.getItem(storageKey(setId));
      if (raw) strokes = JSON.parse(raw).strokes || [];
    } catch { strokes = []; }
  }
  function save() {
    try {
      localStorage.setItem(storageKey(setId), JSON.stringify({ v: 1, strokes }));
    } catch {}
  }

  // ---- 繪製 ----
  const baseCtx = baseCanvas.getContext("2d");
  const liveCtx = liveCanvas.getContext("2d");

  function syncSize() {
    const w = wrap.offsetWidth, h = wrap.offsetHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    for (const [cv, ctx] of [[baseCanvas, baseCtx], [liveCanvas, liveCtx]]) {
      cv.style.width = w + "px";
      cv.style.height = h + "px";
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    redrawBase();
    redrawLive();
  }

  function strokePath(ctx, s, rect) {
    const pts = s.pts;
    if (!pts.length) return;
    const lw = s.tool === "hl" ? HL_W : PEN_W;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = s.tool === "hl" ? 0.35 : 0.9;
    ctx.beginPath();
    const [x0, y0] = pts[0];
    ctx.moveTo(x0 * rect.width, y0 * rect.height);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0] * rect.width, pts[i][1] * rect.height);
    }
    if (pts.length === 1) ctx.lineTo(x0 * rect.width + 0.1, y0 * rect.height + 0.1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function redrawBase() {
    const rect = { width: wrap.offsetWidth, height: wrap.offsetHeight };
    baseCtx.clearRect(0, 0, rect.width, rect.height);
    for (const s of strokes) strokePath(baseCtx, s, rect);
  }

  function redrawLive() {
    const rect = { width: wrap.offsetWidth, height: wrap.offsetHeight };
    liveCtx.clearRect(0, 0, rect.width, rect.height);
    if (drawing) strokePath(liveCtx, drawing, rect);
  }

  // ---- 指針事件 ----
  function normPoint(e) {
    const rect = wrap.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    ];
  }

  function onDown(e) {
    if (!active) return;
    if (pencilOnly && e.pointerType !== "pen") return;
    e.preventDefault();
    try { liveCanvas.setPointerCapture(e.pointerId); } catch {}
    drawing = {
      tool: currentTool.tool,
      color: currentTool.color,
      pts: [normPoint(e)],
    };
    redrawLive();
  }

  function onMove(e) {
    if (!drawing) return;
    e.preventDefault();
    drawing.pts.push(normPoint(e));
    redrawLive();
  }

  function onUp(e) {
    if (!drawing) return;
    strokes.push(drawing);
    drawing = null;
    if (strokes.length > MAX_STROKES) {
      strokes.shift();
      toast("筆跡太多，最早的記號已自動清除");
    }
    redrawLive();
    redrawBase();
    save();
  }

  liveCanvas.addEventListener("pointerdown", onDown);
  liveCanvas.addEventListener("pointermove", onMove);
  liveCanvas.addEventListener("pointerup", onUp);
  liveCanvas.addEventListener("pointercancel", onUp);

  // ---- 工具列 ----
  const chipBtns = [];
  for (const t of TOOLS) {
    const b = el("button", {
      class: "mark-chip" + (t.tool === "hl" ? " hl" : ""),
      style: `--chip-color:${t.color}`,
      title: t.tool === "hl" ? "螢光筆" : "原子筆",
      "aria-label": (t.tool === "hl" ? "螢光筆 " : "原子筆 ") + t.color,
      onclick: () => {
        currentTool = t;
        chipBtns.forEach((x) => x.classList.toggle("on", x._tid === t.id));
      },
    });
    b._tid = t.id;
    chipBtns.push(b);
  }
  chipBtns[0].classList.add("on");

  const pencilBtn = el("button", {
    class: "mark-mode-btn",
    title: "只接受 Apple Pencil（防手掌誤觸）",
    onclick: () => {
      pencilOnly = !pencilOnly;
      pencilBtn.classList.toggle("on", pencilOnly);
    },
  }, "✍️ 僅 Pencil");

  const bar = el("div", { class: "marks-bar hidden" },
    ...chipBtns,
    el("span", { class: "mark-sep" }),
    el("button", {
      class: "mark-mode-btn",
      onclick: () => {
        if (!strokes.length) { toast("沒有可撤销的記號"); return; }
        strokes.pop();
        redrawBase();
        save();
      },
    }, "↩︎ 撤销"),
    el("button", {
      class: "mark-mode-btn",
      onclick: () => {
        if (!strokes.length) return;
        strokes = [];
        redrawBase();
        save();
        toast("已清除全部記號");
      },
    }, "🗑 清除"),
    pencilBtn,
  );

  const toggleBtn = el("button", {
    class: "marks-toggle",
    "aria-label": "切換手寫記號",
    onclick: () => {
      active = !active;
      toggleBtn.classList.toggle("on", active);
      bar.classList.toggle("hidden", !active);
      liveCanvas.classList.toggle("active", active);
      if (!active && drawing) { drawing = null; redrawLive(); }
    },
  }, "✏️ 記號");

  const titleRow = paneEl.querySelector(".pane-title");
  if (titleRow) titleRow.append(toggleBtn, bar);

  // ---- 尺寸監聽 ----
  ro = new ResizeObserver(() => syncSize());
  ro.observe(wrap);
  load();
  // 等排版穩定後首次同步（字型載入可能改變高度）
  requestAnimationFrame(syncSize);
  if (document.fonts?.ready) document.fonts.ready.then(() => syncSize());

  function destroy() {
    ro && ro.disconnect();
    if (drawing) { drawing = null; }
    save();
    toggleBtn.remove();
    bar.remove();
    baseCanvas.remove();
    liveCanvas.remove();
    // 解開包裹層，還原原 DOM 結構
    contentEl.parentNode === wrap && wrap.parentNode.insertBefore(contentEl, wrap);
    wrap.remove();
  }

  return ctrl;
}
