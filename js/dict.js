// 點詞查義：ECDICT 子集 + 詞形還原（不規則變化表 + 規則推導）
// 資料按需載入：只在復盤頁第一次點詞時抓取。
import { el, toast } from "./util.js";
import { addCustomWord } from "./store.js";

let dict = null;   // { word: [phonetic, translation] }
let forms = null;  // { inflected: base }
let lastHit = null;

async function ensureLoaded() {
  if (dict) return;
  const [d, f] = await Promise.all([
    fetch("data/dict.json").then((r) => r.json()),
    fetch("data/forms.json").then((r) => r.json()),
  ]);
  dict = d;
  forms = f;
}

// 規則推導可能的原形
function ruleBases(w) {
  const out = [];
  const push = (x) => { if (x && x.length > 1 && !out.includes(x)) out.push(x); };
  if (w.endsWith("ies")) { push(w.slice(0, -3) + "y"); }
  if (w.endsWith("ves")) { push(w.slice(0, -3) + "f"); push(w.slice(0, -3) + "fe"); }
  if (w.endsWith("es")) { push(w.slice(0, -2)); }
  if (w.endsWith("s") && !w.endsWith("ss")) { push(w.slice(0, -1)); }
  if (w.endsWith("ing")) {
    const stem = w.slice(0, -3);
    push(stem); push(stem + "e");
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) push(stem.slice(0, -1));
  }
  if (w.endsWith("ed")) {
    const stem = w.slice(0, -2);
    push(stem); push(stem + "e"); push(w.slice(0, -1));
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) push(stem.slice(0, -1));
  }
  if (w.endsWith("est")) {
    const stem = w.slice(0, -3);
    push(stem); push(stem + "e");
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) push(stem.slice(0, -1));
  }
  if (w.endsWith("er")) {
    const stem = w.slice(0, -2);
    push(stem); push(stem + "e");
  }
  if (w.endsWith("ly")) { push(w.slice(0, -2)); if (w.endsWith("ily")) push(w.slice(0, -3) + "y"); }
  return out;
}

const XREF_RE = /的(过去式|过去分词|现在分词|复数|原形|比较级|最高级)|（|see /;

function lookupWord(w) {
  w = w.toLowerCase();
  const direct = dict[w];
  // 直接命中且不是交叉引用條目 → 直接使用
  if (direct && !XREF_RE.test(direct[1])) {
    return { word: w, phonetic: direct[0], meaning: direct[1] };
  }
  // 嘗試還原原形（不規則表優先，其次規則推導）
  const bases = [];
  if (forms && forms[w]) bases.push(forms[w]);
  bases.push(...ruleBases(w));
  for (const b of bases) {
    if (dict[b]) return { word: b, phonetic: dict[b][0], meaning: dict[b][1], origin: w };
  }
  if (direct) return { word: w, phonetic: direct[0], meaning: direct[1] };
  return null;
}

// ---- UI：底部詞義卡 ----
let sheetBound = false;
let addBtn = null;
function ensureSheetBindings() {
  if (sheetBound) return;
  sheetBound = true;
  const sheet = document.getElementById("dict-sheet");
  document.getElementById("dict-close").addEventListener("click", hideWordLookup);
  sheet.querySelector(".sheet-mask").addEventListener("click", hideWordLookup);
  addBtn = el("button", {
    class: "btn small ghost", style: "margin-top:14px",
    onclick: () => {
      if (!lastHit) return;
      const ok = addCustomWord(lastHit.origin || lastHit.word, lastHit.meaning);
      toast(ok ? "已加入生字本，可在「背單字」練習" : "生字本裡已經有這個字了");
      if (ok) { addBtn.textContent = "✓ 已在生字本"; addBtn.disabled = true; }
    },
  }, "＋ 加入生字本");
  sheet.querySelector(".sheet-panel").append(addBtn);
}

export async function showWordLookup(rawWord) {
  const word = (rawWord || "").trim().toLowerCase();
  if (!word || !/^[a-zA-Z][a-zA-Z'\-]*$/.test(word)) return;
  ensureSheetBindings();
  const sheet = document.getElementById("dict-sheet");
  const wordEl = document.getElementById("dict-word");
  const phEl = document.getElementById("dict-phonetic");
  const meanEl = document.getElementById("dict-meaning");
  wordEl.textContent = rawWord;
  phEl.textContent = "查詢中…";
  meanEl.textContent = "";
  addBtn.classList.add("hidden");
  lastHit = null;
  sheet.classList.remove("hidden");
  try {
    await ensureLoaded();
    const hit = lookupWord(word);
    if (hit) {
      lastHit = hit;
      wordEl.textContent = hit.origin && hit.origin !== hit.word
        ? `${rawWord}（原形：${hit.word}）` : rawWord;
      phEl.textContent = hit.phonetic ? "/" + hit.phonetic + "/" : "";
      meanEl.textContent = hit.meaning;
      addBtn.textContent = "＋ 加入生字本";
      addBtn.disabled = false;
      addBtn.classList.remove("hidden");
    } else {
      phEl.textContent = "";
      meanEl.textContent = "詞典中未收錄這個詞形。";
    }
  } catch {
    phEl.textContent = "";
    meanEl.textContent = "詞典載入失敗，請檢查網路後重試。";
  }
}

export function hideWordLookup() {
  document.getElementById("dict-sheet").classList.add("hidden");
}

// ---- 復盤頁文章加工：把單字包成可點擊元素 ----
const TOKEN_RE = /[A-Za-z][A-Za-z'\-]*/g;

export function makeWordsTappable(container, onClick) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    const text = node.nodeValue;
    if (!/[A-Za-z]/.test(text)) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of text.matchAll(TOKEN_RE)) {
      const i = m.index;
      if (i > last) frag.append(text.slice(last, i));
      const span = document.createElement("span");
      span.className = "word";
      span.dataset.w = m[0];
      span.textContent = m[0];
      frag.append(span);
      last = i + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }
  container.addEventListener("click", (e) => {
    const w = e.target.closest(".word");
    if (w) onClick(w.dataset.w);
  });
}
