// 背單字：翻卡背誦 + 快速測驗 + 清單瀏覽
// 資料來源：data/vocab/senior2.json（離線快取）+ 使用者自訂生字本
import { el, toast, shuffle } from "../util.js";
import { renderTopbar, themeToggleBtn } from "../ui.js";
import {
  getVocabProgress, setWordStatus, setWordBox, vocabStats,
  listCustomWords, removeCustomWord,
} from "../store.js";

let vocabData = null;
async function loadVocab() {
  if (!vocabData) {
    vocabData = await (await fetch("data/vocab/senior2.json", { cache: "no-cache" })).json();
  }
  return vocabData;
}

// listId -> 詞條陣列（含自訂生字本）
function poolOf(listId) {
  if (listId === "custom") return listCustomWords();
  const l = vocabData.lists.find((x) => x.id === listId);
  return l ? l.words : [];
}
const LIST_TITLES = { w1: "高頻詞彙 1-599", w2: "高頻詞彙 600-690", ph: "高考高頻短語", custom: "我的生字本" };

function statusChip(prog, uid) {
  const st = prog[uid];
  if (!st) return el("span", { class: "chip" }, "未學");
  if (st.box >= 2) return el("span", { class: "chip good" }, "✓ 掌握");
  return el("span", { class: "chip warn" }, "學習中");
}

// ============ 主頁 ============
export async function renderVocab(ctx) {
  const data = await loadVocab();
  renderTopbar({
    title: "背單字",
    back: () => ctx.go("#/home"),
    right: [themeToggleBtn()],
  });
  const view = document.getElementById("view");
  view.innerHTML = "";
  view.classList.add("page-narrow");

  const total = data.lists.reduce((n, l) => n + l.words.length, 0) + listCustomWords().length;
  const stats = vocabStats();

  view.append(el("div", { class: "card score-card", style: "margin-bottom:14px" },
    el("div", {},
      el("div", { class: "score-num" }, String(stats.mastered), el("small", {}, ` / ${total}`)),
      el("div", { style: "font-weight:700;font-size:14px;margin-top:4px;color:var(--good)" }, "已掌握"),
    ),
    el("div", { class: "score-meta" },
      el("span", {}, `學習中 ${stats.learning} 個 · 未開始 ${total - stats.seen} 個`),
      el("span", { style: "color:var(--muted);font-size:12.5px" }, "資料保存在本設備，可離線使用；換設備用「進度備份」搬運"),
    ),
  ));

  // 清單選擇
  let listId = "w1";
  const chips = el("div", { class: "filter-row", style: "flex-wrap:wrap" });
  const paintChips = () => {
    chips.innerHTML = "";
    const opts = [...data.lists.map((l) => ({ id: l.id, label: LIST_TITLES[l.id], count: l.words.length })),
      { id: "custom", label: "我的生字本", count: listCustomWords().length }];
    for (const o of opts) {
      chips.append(el("button", {
        class: "fchip" + (listId === o.id ? " on" : ""),
        onclick: () => { listId = o.id; paintChips(); },
      }, `${o.label} (${o.count})`));
    }
  };
  paintChips();
  view.append(chips);

  // 模式入口
  const modes = el("div", { class: "set-list", style: "grid-template-columns:1fr 1fr;gap:12px;margin-top:6px" },
    el("div", { class: "card set-card" },
      el("div", { class: "t" }, "🃏 翻卡背誦"),
      el("div", { class: "best" }, "看英文想中文，不會的自動重排"),
      el("button", { class: "btn small go", onclick: () => ctx.go(`#/vocab/flash/${listId}`) }, "開始"),
    ),
    el("div", { class: "card set-card" },
      el("div", { class: "t" }, "⚡ 快速測驗"),
      el("div", { class: "best" }, "10 題四選一，英中雙向"),
      el("button", { class: "btn small go", onclick: () => ctx.go(`#/vocab/quiz/${listId}`) }, "開始"),
    ),
  );
  view.append(modes);

  view.append(el("div", { style: "margin-top:14px" },
    el("button", {
      class: "btn secondary block",
      onclick: () => ctx.go(`#/vocab/list/${listId}`),
    }, "📋 瀏覽清單 / 管理生字"),
  ));

  view.append(el("div", { style: "margin-top:16px" },
    el("button", {
      class: "btn ghost block",
      onclick: () => ctx.go("#/run/reading/r01"),
    }, "去閱讀文章查詞，把生字加進生字本 →"),
  ));
}

// ============ 翻卡背誦 ============
export async function renderVocabFlash(ctx, listId) {
  const data = await loadVocab();
  const pool = poolOf(listId);
  if (!pool.length) { toast("這個清單還沒有單字"); ctx.go("#/vocab"); return; }
  const prog = getVocabProgress();

  // 選卡：未學 → 重學中 → 學習中 → 已掌握(最久沒看)
  const ranked = pool.map((w) => {
    const st = prog[w.id];
    const tier = !st ? 0 : st.box === 0 ? 1 : st.box === 1 ? 2 : 3;
    return { w, tier, ts: st?.ts || 0 };
  });
  ranked.sort((a, b) => (a.tier - b.tier) || (a.ts - b.ts));
  const session = shuffle(ranked.slice(0, 12).map((r) => r.w));
  if (!session.length) { ctx.go("#/vocab"); return; }

  renderTopbar({ title: `翻卡 · ${LIST_TITLES[listId] || "生字本"}`, back: () => ctx.go("#/vocab") });
  const view = document.getElementById("view");
  view.innerHTML = "";
  view.classList.add("page-narrow");

  let idx = 0, flipped = false, right = 0, wrong = 0;

  const counter = el("div", { class: "prog", style: "text-align:center;font-weight:700;color:var(--muted);margin-bottom:10px" });
  const cardBox = el("div", { class: "vcard-box" });
  const actions = el("div", { class: "flash-actions hidden" },
    el("button", { class: "btn danger block", onclick: () => answer(false) }, "❌ 不會"),
    el("button", { class: "btn block", style: "background:var(--good)", onclick: () => answer(true) }, "✅ 懂了"),
  );
  view.append(counter, cardBox, actions);

  function paint() {
    const w = session[idx];
    counter.textContent = `第 ${idx + 1} / ${session.length} 張`;
    cardBox.innerHTML = "";
    cardBox.append(el("div", {
      class: "card vcard" + (flipped ? " flipped" : ""),
      onclick: () => { if (!flipped) { flipped = true; paint(); } },
    },
      flipped
        ? el("div", { class: "vcard-back" },
            el("div", { class: "vcard-word" }, w.w),
            w.pos ? el("div", { class: "vcard-pos" }, w.pos) : null,
            el("div", { class: "vcard-zh" }, w.zh),
            el("div", { class: "vcard-hint" }, "記住了嗎？"),
          )
        : el("div", { class: "vcard-front" },
            el("div", { class: "vcard-word" }, w.w),
            w.pos ? el("div", { class: "vcard-pos" }, w.pos) : null,
            el("div", { class: "vcard-hint" }, "先想一想意思，再點卡片翻面"),
          ),
    ));
    actions.classList.toggle("hidden", !flipped);
  }

  function answer(known) {
    const w = session[idx];
    setWordStatus(w.id, known);
    known ? right++ : wrong++;
    idx++; flipped = false;
    if (idx >= session.length) return finish();
    paint();
  }

  function finish() {
    cardBox.innerHTML = "";
    counter.textContent = "本輪完成！";
    cardBox.append(el("div", { class: "card score-card" },
      el("div", {},
        el("div", { class: "score-num", style: "color:var(--good)" }, String(right), el("small", {}, ` / ${session.length}`)),
        el("div", { style: "font-weight:700;font-size:14px;margin-top:4px" }, `答對 ${right} · 標記不會 ${wrong}`),
      ),
      el("div", { class: "score-meta" },
        el("span", {}, wrong ? "不會的單字會優先出現在下輪。" : "太棒了，全部記住！"),
      ),
      el("div", { class: "score-actions" },
        el("button", { class: "btn small", onclick: () => ctx.go(`#/vocab/flash/${listId}`) }, "再來一輪"),
        el("button", { class: "btn small secondary", onclick: () => ctx.go("#/vocab") }, "返回"),
      ),
    ));
    actions.classList.add("hidden");
  }

  paint();
}

// ============ 快速測驗 ============
export async function renderVocabQuiz(ctx, listId) {
  const data = await loadVocab();
  const pool = poolOf(listId);
  if (pool.length < 4) { toast("這個清單單字太少，無法出題"); ctx.go("#/vocab"); return; }

  // 抽 10 題（優先未學/學習中）
  const prog = getVocabProgress();
  const ranked = pool.map((w) => {
    const st = prog[w.id];
    const tier = !st ? 0 : st.box === 0 ? 1 : st.box === 1 ? 2 : 3;
    return { w, tier };
  });
  ranked.sort((a, b) => a.tier - b.tier);
  const picked = shuffle(ranked.slice(0, 12)).slice(0, 10).map((r) => r.w);

  const questions = picked.map((w, i) => {
    const toZh = i % 2 === 0; // 偶數題英→中
    const distract = shuffle(pool.filter((x) => x.id !== w.id)).slice(0, 3);
    const correctText = toZh ? w.zh : w.w;
    const options = shuffle([correctText, ...distract.map((d) => (toZh ? d.zh : d.w))]);
    return { w, toZh, options, answerIdx: options.indexOf(correctText), user: null };
  });

  renderTopbar({ title: `測驗 · ${LIST_TITLES[listId] || "生字本"}`, back: () => ctx.go("#/vocab") });
  const view = document.getElementById("view");
  view.innerHTML = "";
  view.classList.add("page-narrow");

  let idx = 0, score = 0;
  const counter = el("div", { class: "prog", style: "text-align:center;font-weight:700;color:var(--muted);margin-bottom:10px" });
  const qBox = el("div", {});
  view.append(counter, qBox);

  function paint() {
    const q = questions[idx];
    counter.textContent = `第 ${idx + 1} / ${questions.length} 題`;
    qBox.innerHTML = "";
    const opts = el("div", { class: "opts" });
    q.options.forEach((opt, oi) => {
      opts.append(el("button", {
        class: "opt" + (q.user !== null ? " no-interact" : ""),
        style: "min-height:52px",
        onclick: () => {
          if (q.user !== null) return;
          q.user = oi;
          if (oi === q.answerIdx) score++;
          setWordStatus(q.w.id, oi === q.answerIdx);
          [...opts.children].forEach((b, bi) => {
            b.classList.remove("on");
            if (bi === q.answerIdx) b.classList.add("correct");
            else if (bi === oi) b.classList.add("yours-wrong");
          });
          nextBtn.disabled = false;
        },
      }, el("span", { class: "key" }, "ABCD"[oi]), el("span", { class: "word-b" }, opt)));
    });
    const nextBtn = el("button", {
      class: "btn block", disabled: true, style: "margin-top:14px",
      onclick: () => { idx++; idx >= questions.length ? finish() : paint(); },
    }, idx === questions.length - 1 ? "看結果" : "下一題");
    qBox.append(
      el("div", { class: "card rv-item" },
        el("div", { class: "q-head" },
          el("span", { class: "chip" }, q.toZh ? "英 → 中" : "中 → 英"),
          q.w.pos && q.toZh ? el("span", { class: "chip" }, q.w.pos) : null,
        ),
        el("div", { class: "q-stem", style: "font-size:20px;font-family:var(--serif);margin-bottom:12px" }, q.toZh ? q.w.w : q.w.zh),
        opts,
      ),
      nextBtn,
    );
  }

  function finish() {
    qBox.innerHTML = "";
    counter.textContent = "測驗完成！";
    const wrongList = questions.filter((q) => q.user !== q.answerIdx);
    qBox.append(el("div", { class: "card score-card" },
      el("div", {},
        el("div", { class: "score-num", style: score >= 8 ? "color:var(--good)" : score >= 5 ? "color:var(--warn)" : "color:var(--bad)" },
          String(score), el("small", {}, ` / ${questions.length}`)),
        el("div", { style: "font-weight:700;font-size:14px;margin-top:4px" }, `正確率 ${Math.round((100 * score) / questions.length)}%`),
      ),
      el("div", { class: "score-meta" },
        wrongList.length ? el("span", {}, "錯的單字已標記為重學，會優先出現") : el("span", { class: "chip good" }, "全對！🎉"),
      ),
      el("div", { class: "score-actions" },
        el("button", { class: "btn small", onclick: () => ctx.go(`#/vocab/quiz/${listId}`) }, "再測一次"),
        el("button", { class: "btn small secondary", onclick: () => ctx.go("#/vocab") }, "返回"),
      ),
    ));
    if (wrongList.length) {
      qBox.append(el("div", { class: "card rv-item", style: "margin-top:12px" },
        el("div", { class: "q-head" }, el("span", { class: "chip bad" }, "本輪錯題")),
        ...wrongList.map((q) => el("div", { class: "hist-item" },
          el("div", { class: "info" },
            el("div", { class: "t" }, q.w.w + (q.w.pos ? " " + q.w.pos : "")),
            el("div", { class: "s" }, q.w.zh),
          ),
        )),
      ));
    }
  }

  paint();
}

// ============ 清單瀏覽 ============
export async function renderVocabList(ctx, listId) {
  const data = await loadVocab();
  const pool = poolOf(listId);
  renderTopbar({ title: LIST_TITLES[listId] || "生字本", back: () => ctx.go("#/vocab") });
  const view = document.getElementById("view");
  view.innerHTML = "";
  view.classList.add("page-narrow");

  let query = "";
  const search = el("input", {
    type: "text", placeholder: "搜尋單字或中文…", autocomplete: "off",
    oninput: (e) => { query = e.target.value.trim().toLowerCase(); paint(); },
  });
  view.append(el("div", { style: "margin-bottom:12px" }, search));
  const listBox = el("div", { class: "card" });
  view.append(listBox);

  function paint() {
    const prog = getVocabProgress();
    listBox.innerHTML = "";
    const rows = pool.filter((w) =>
      !query || w.w.toLowerCase().includes(query) || (w.zh || "").toLowerCase().includes(query));
    if (!rows.length) {
      listBox.append(el("div", { class: "empty" }, query ? "沒有符合的單字" : "生字本還是空的——閱讀文章時點單字 → ＋生字本"));
      return;
    }
    for (const w of rows) {
      const detail = el("div", { class: "vrow-detail hidden" },
        el("div", { class: "vcard-zh", style: "padding:0 4px 8px" }, w.zh || "（未填釋義）"),
        el("div", { style: "display:flex;gap:8px;padding:0 4px 4px" },
          el("button", {
            class: "btn small secondary",
            onclick: (e) => { e.stopPropagation(); setWordBox(w.id, 0); toast("已標記為重學"); paint(); },
          }, "重學"),
          el("button", {
            class: "btn small", style: "background:var(--good)",
            onclick: (e) => { e.stopPropagation(); setWordBox(w.id, 2); toast("已標記為掌握"); paint(); },
          }, "✓ 掌握"),
          listId === "custom" ? el("button", {
            class: "btn small danger", style: "margin-left:auto",
            onclick: (e) => { e.stopPropagation(); removeCustomWord(w.id); toast("已從生字本移除"); paint(); },
          }, "刪除") : null,
        ),
      );
      listBox.append(el("div", { class: "vrow" },
        el("button", {
          class: "hist-item", style: "width:100%;text-align:left",
          onclick: () => detail.classList.toggle("hidden"),
        },
          el("div", { class: "info" },
            el("div", { class: "t" }, w.w + (w.pos ? `  ${w.pos}` : "")),
            el("div", { class: "s" }, w.zh),
          ),
          statusChip(prog, w.id),
        ),
        detail,
      ));
    }
  }
  paint();
}
