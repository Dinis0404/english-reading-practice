// 復盤解析：成績總覽 + 逐題解析 + 點詞查義（僅完成後開放）
import { el, fmtDuration, fmtDate, confirmDialog } from "../util.js";
import { loadSet, getAttempt, bestScoreOf, attemptCountOf } from "../store.js";
import { renderTopbar } from "../ui.js";
import { showWordLookup, hideWordLookup, makeWordsTappable } from "../dict.js";

export async function renderReview(ctx, type, id, attemptKey) {
  const setData = await loadSet(type, id);
  const attempt = getAttempt(attemptKey) || JSON.parse(sessionStorage.getItem("erp_last_attempt") || "null");
  if (!attempt || attempt.setId !== id) {
    ctx.go("#/home");
    return;
  }

  renderTopbar({
    title: "復盤解析",
    back: () => ctx.go("#/home"),
    right: [],
  });

  const view = document.getElementById("view");
  view.innerHTML = "";

  // ---- 成績卡 ----
  const pct = Math.round((100 * attempt.score) / attempt.total);
  const grade = pct >= 80 ? "good" : pct >= 60 ? "mid" : "bad";
  const comment = pct >= 90 ? "非常出色！繼續保持。" : pct >= 80 ? "表現很好，看看錯題就更完美了。" :
    pct >= 60 ? "有進步空間，重點復盤錯題。" : "別灰心，逐題看解析、累積詞彙再來一次。";

  const scoreCard = el("div", { class: "card score-card" },
    el("div", { style: `color:var(--${grade === "mid" ? "warn" : grade})` },
      el("div", { class: "score-num" }, String(attempt.score), el("small", {}, ` / ${attempt.total}`)),
      el("div", { style: "font-weight:700;font-size:15px;margin-top:4px" }, `正確率 ${pct}%`),
    ),
    el("div", { class: "score-meta" },
      el("span", {}, `用時 ${fmtDuration(attempt.timeSpent)}`),
      attempt.timedOut ? el("span", { class: "chip bad" }, "超時自動交卷") : null,
      attempt.timed ? el("span", { class: "chip" }, "限時模式") : el("span", { class: "chip" }, "不限時"),
      el("span", { class: "chip" }, fmtDate(attempt.createdAt)),
      el("span", { style: "color:var(--muted)" }, comment),
    ),
    el("div", { class: "score-actions" },
      el("button", { class: "btn small", onclick: () => ctx.go(`#/run/${type}/${id}`) }, "再做一次"),
      el("button", { class: "btn small secondary", onclick: () => ctx.go("#/home") }, "返回題庫"),
      (() => {
        const best = bestScoreOf(id);
        if (!best || best.key === attempt.key) return null;
        return el("button", { class: "btn small secondary", onclick: () => ctx.go(`#/review/${type}/${id}/${encodeURIComponent(best.key)}`) }, "最佳記錄");
      })(),
    ),
  );
  view.append(scoreCard);

  // ---- 切換：全部 / 只看錯題 ----
  let onlyWrong = false;
  const seg = el("div", { class: "seg", style: "margin:16px 0 12px" },
    el("button", { class: "on", onclick: () => toggle(false) }, `全部（${attempt.total}）`),
    el("button", { onclick: () => toggle(true) }, `只看錯題（${attempt.total - attempt.score}）`),
  );
  function toggle(v) {
    onlyWrong = v;
    [...seg.children].forEach((b, i) => b.classList.toggle("on", (i === 1) === v));
    paint();
  }
  view.append(seg);

  // ---- 雙欄：文章（點詞查義）+ 解析清單 ----
  const wrap = el("div", { class: "runner" });
  view.append(wrap);

  // 文章欄
  const passagePane = el("div", { class: "pane passage" },
    el("div", { class: "pane-title" }, "原文（點單字查詞義）"),
  );
  const pScroll = el("div", { class: "pane-scroll" });
  const pText = el("div", { class: "passage-text review-passage" });
  pScroll.append(pText);
  passagePane.append(pScroll);
  wrap.append(passagePane);

  if (type === "cloze") {
    renderClozeReviewPassage(setData, attempt, pText);
  } else {
    for (const para of setData.passage.split("\n")) {
      pText.append(el("p", {}, para));
    }
  }
  makeWordsTappable(pText, (w) => showWordLookup(w));

  // 解析清單欄
  const rvPane = el("div", { class: "pane qpane" }, el("div", { class: "pane-title" }, "逐題解析"));
  const rvScroll = el("div", { class: "pane-scroll" });
  const rvList = el("div", {});
  rvScroll.append(rvList);
  rvPane.append(rvScroll);
  wrap.append(rvPane);

  function paint() {
    rvList.innerHTML = "";
    setData.questions.forEach((q, i) => {
      const ua = attempt.answers[i];
      const ok = ua === q.answer;
      if (onlyWrong && ok) return;

      const opts = el("div", { class: "opts rv" });
      q.options.forEach((opt, oi) => {
        const isCorrect = oi === q.answer;
        const isYours = oi === ua;
        let cls = "opt";
        if (isCorrect) cls += " correct";
        else if (isYours) cls += " yours-wrong";
        opts.append(el("div", { class: cls },
          el("span", { class: "key" }, "ABCD"[oi]),
          el("span", { class: "word-b" }, opt),
          isYours && !isCorrect ? el("span", { class: "chip bad", style: "margin-left:auto" }, "你的答案") : null,
          isCorrect && isYours ? el("span", { class: "chip good", style: "margin-left:auto" }, "✓") : null,
          isCorrect && !isYours ? el("span", { class: "chip good", style: "margin-left:auto" }, "正確答案") : null,
        ));
      });

      const head = el("div", { class: "q-head" },
        el("span", { class: "q-num", style: ok ? "background:var(--good)" : ua === null || ua === -1 ? "background:var(--warn)" : "background:var(--bad)" }, i + 1),
        q.q ? el("div", { class: "q-stem" }, q.q) : null,
        el("span", { class: "chip", style: "margin-left:auto" }, ok ? "答對" : (ua === null || ua === -1 ? "未作答" : "答錯")),
      );

      const item = el("div", { class: "card rv-item", id: "q" + i },
        head, opts,
        // 完形填空：顯示該空所在句子
        type === "cloze" ? ctxSentence(setData, i) : null,
        q.note ? el("div", { class: "rv-note" }, el("b", {}, "解析　"), q.note) : null,
      );
      rvList.append(item);
    });
    if (!rvList.children.length) rvList.append(el("div", { class: "empty" }, "全對，沒有錯題！🎉"));
  }
  paint();

  // 點擊空格 → 捲到對應解析
  pText.addEventListener("click", (e) => {
    const blank = e.target.closest(".blank");
    if (!blank) return;
    const card = rvList.querySelector("#q" + blank.dataset.n);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // 離開時關閉詞義卡
  ctx.onLeave(() => hideWordLookup());
}

function ctxSentence(setData, qi) {
  // 從文章中抽出含第 qi 空的句子
  const m = setData.passage.split(/\[\[(\d+)\]\]/);
  let before = "", after = "";
  for (let idx = 0; idx < m.length; idx += 2) {
    if (idx + 1 < m.length && parseInt(m[idx + 1], 10) === qi + 1) {
      before = m[idx]; after = m[idx + 2] || "";
      break;
    }
  }
  const sentEnd = (str, dir) => {
    if (dir > 0) {
      const match = str.match(/^[\s\S]*?[.!?](\s|$)/);
      return match ? match[0] : str;
    }
    const parts = str.split(/(?<=[.!?])\s+/);
    return parts[parts.length - 1] || str;
  };
  const sentence = sentEnd(before.trim(), -1) + " ＿＿ " + sentEnd(after.trim(), 1);
  const q = setData.questions[qi];
  return el("div", { class: "ctx-sentence" },
    sentence.replace("＿＿", `${q.options[q.answer]}`),
    el("div", { style: "font-size:12px;color:var(--faint);margin-top:4px" }, "▲ 該空填入正確答案後的句子"),
  );
}

function renderClozeReviewPassage(setData, attempt, container) {
  const parts = setData.passage.split(/\[\[(\d+)\]\]/);
  parts.forEach((part, idx) => {
    if (idx % 2 === 0) {
      container.append(document.createTextNode(part));
    } else {
      const qi = parseInt(part, 10) - 1;
      const q = setData.questions[qi];
      const ua = attempt.answers[qi];
      const ok = ua === q.answer;
      const stateCls = ok ? "ok" : (ua === null || ua === -1 ? "miss" : "no");
      const tip = ok ? `第 ${qi + 1} 空：正確` :
        (ua === null || ua === -1 ? `第 ${qi + 1} 空：未作答，正確答案 ${q.options[q.answer]}` :
          `第 ${qi + 1} 空：你選 ${q.options[ua]}，正確答案 ${q.options[q.answer]}`);
      container.append(el("button", {
        class: `blank filled ${stateCls}`, "data-n": qi, title: tip,
      },
        el("span", { class: "n" }, String(qi + 1)),
        el("span", { class: "w" }, q.options[q.answer]),
      ));
    }
  });
}
