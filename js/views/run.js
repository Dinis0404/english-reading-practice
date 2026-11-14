// 作答頁：完形填空 & 閱讀理解共用 runner
// 直向單欄（文章 → 題目），橫向 ≥980px 雙欄同步捲動
import { el, fmtClock, confirmDialog, toast } from "../util.js";
import { loadSet, saveAttempt, makeAttempt, bestScoreOf } from "../store.js";
import { renderTopbar, timerChip } from "../ui.js";

export async function renderRun(ctx, type, id) {
  const setData = await loadSet(type, id);

  // ---- 開始面板：選限時 / 不限時 ----
  const best = bestScoreOf(id);
  const view = document.getElementById("view");
  view.innerHTML = "";
  renderTopbar({ title: setData.title, back: () => ctx.go("#/home") });

  const hero = el("div", { class: "card start-hero" },
    el("div", { style: "display:flex;flex-wrap:wrap;gap:6px" },
      el("span", { class: "chip lv" }, setData.level),
      el("span", { class: "chip" }, setData.genre),
      el("span", { class: "chip" }, setData.style),
      el("span", { class: "chip" }, type === "cloze" ? `${setData.questions.length} 空` : `${setData.questions.length} 題`),
      el("span", { class: "chip" }, `建議 ${setData.minutes} 分`),
    ),
    el("h1", {}, setData.title),
    el("div", { class: "desc" }, setData.intro || ""),
    best ? el("div", { class: "desc" }, `上次成績：${best.score}/${best.total}（${Math.round((100 * best.score) / best.total)}%）`) : null,
    el("div", { style: "display:flex;gap:10px;flex-wrap:wrap" },
      el("button", { class: "btn", onclick: () => start(true) }, `限時挑戰（${setData.minutes} 分）`),
      el("button", { class: "btn secondary", onclick: () => start(false) }, "不限時練習"),
    ),
    el("p", { style: "font-size:12.5px;color:var(--faint)" },
      "作答中不會顯示答案；完成後將進入復盤解析，屆時可以點擊文章中的任何單字查詞義。"),
  );
  view.append(hero);

  function start(timed) {
    runQuiz(ctx, type, id, setData, timed).catch((e) => {
      console.error(e);
      toast("載入失敗：" + e.message);
    });
  }
}

async function runQuiz(ctx, type, id, setData, timed) {
  const n = setData.questions.length;
  const answers = new Array(n).fill(null);
  let timedOut = false;
  const startedAt = Date.now();
  const limitSec = setData.minutes * 60;

  // ---- 頂欄 + 計時器 ----
  const chip = timerChip();
  let timerId = null;
  let remaining = limitSec;

  const tick = () => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const shown = timed ? Math.max(0, limitSec - elapsed) : elapsed;
    chip.textContent = fmtClock(shown);
    if (timed) {
      chip.classList.toggle("warn", shown <= 60 && shown > 20);
      chip.classList.toggle("danger", shown <= 20);
      if (shown <= 0) {
        clearInterval(timerId);
        timedOut = true;
        toast("時間到，自動交卷");
        submit(true);
      }
    }
  };
  timerId = setInterval(tick, 1000);
  tick();

  renderTopbar({
    title: setData.title,
    back: () => confirmDialog("確定離開？", "離開後本次作答不會記錄成績。", "離開", () => {
      clearInterval(timerId);
      ctx.go("#/home");
    }),
    right: [chip],
  });

  // ---- 版面 ----
  const view = document.getElementById("view");
  view.innerHTML = "";
  const runner = el("div", { class: "runner" });
  view.append(runner);

  // 文章欄
  const passagePane = el("div", { class: "pane passage" },
    el("div", { class: "pane-title" }, "閱讀文章"),
  );
  const passageScroll = el("div", { class: "pane-scroll" });
  const passageText = el("div", { class: "passage-text" });
  passageScroll.append(passageText);
  passagePane.append(passageScroll);

  // 題目欄
  const qPane = el("div", { class: "pane qpane" },
    el("div", { class: "pane-title" }, type === "cloze" ? `選擇填入（共 ${n} 空）` : `回答問題（共 ${n} 題）`),
  );
  const qScroll = el("div", { class: "pane-scroll" });
  const qList = el("div", {});
  qScroll.append(qList);

  const prog = el("span", { class: "prog" }, `已答 0/${n}`);
  const submitBtn = el("button", { class: "btn", disabled: true }, "交卷");
  qPane.append(qScroll, el("div", { class: "submit-bar" }, prog, submitBtn));

  if (type === "reading") runner.append(passagePane, qPane);

  const qCards = [];

  // ---- 文章渲染 ----
  if (type === "cloze") {
    renderClozePassage(setData, passageText, answers, qCards);
    runner.append(passagePane, qPane);
  } else {
    for (const para of setData.passage.split("\n")) {
      passageText.append(el("p", {}, para));
    }
  }

  // ---- 題目渲染 ----
  setData.questions.forEach((q, i) => {
    const opts = el("div", { class: "opts" });
    q.options.forEach((opt, oi) => {
      opts.append(el("button", {
        class: "opt",
        onclick: () => {
          answers[i] = oi;
          [...opts.children].forEach((b, bi) => b.classList.toggle("on", bi === oi));
          card.classList.add("done");
          updateProgress();
          if (type === "cloze") updateBlank(i, oi, false);
        },
      },
        el("span", { class: "key" }, "ABCD"[oi]),
        el("span", { class: "word-b" }, opt),
      ));
    });
    const card = el("div", { class: "q-card", id: "q" + i },
      el("div", { class: "q-head" },
        el("span", { class: "q-num" }, i + 1),
        q.q ? el("div", { class: "q-stem" }, q.q) : null,
      ),
      opts,
    );
    qCards.push(card);
    qList.append(card);
  });

  function updateProgress() {
    const done = answers.filter((a) => a !== null).length;
    prog.textContent = `已答 ${done}/${n}`;
    submitBtn.disabled = done === 0;
    submitBtn.textContent = done === n ? "交卷 ✓" : "交卷";
  }

  submitBtn.addEventListener("click", () => {
    const unanswered = answers.map((a, i) => (a === null ? i + 1 : null)).filter((x) => x !== null);
    if (unanswered.length) {
      confirmDialog("還有題目未作答",
        el("div", {}, "以下題目未作答，確定要交卷嗎？",
          el("div", { class: "un-list" }, "第 " + unanswered.join("、") + " 題")),
        "仍要交卷", () => submit(false), true);
    } else {
      submit(false);
    }
  });

  function submit(auto = false) {
    if (!auto) clearInterval(timerId);
    const timeSpent = Math.floor((Date.now() - startedAt) / 1000);
    const attempt = makeAttempt(setData, answers, { timeSpent, timedOut, timed });
    saveAttempt(attempt);
    ctx.go(`#/review/${type}/${id}/${encodeURIComponent(attempt.key)}`);
  }

  // ---- 完形填空：文章空格渲染 ----
  function renderClozePassage(set, container, ans, cards) {
    const parts = set.passage.split(/\[\[(\d+)\]\]/);
    // 偶數索引為文字，奇數索引為空格編號
    parts.forEach((part, idx) => {
      if (idx % 2 === 0) {
        container.append(document.createTextNode(part));
      } else {
        const blankN = parseInt(part, 10) - 1; // 題目索引
        const numEl = el("span", { class: "n" }, String(blankN + 1));
        const wordEl = el("span", { class: "w" }, "　　");
        const btn = el("button", {
          class: "blank", "data-n": blankN,
          onclick: () => {
            const card = cards[blankN];
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            cards.forEach((c) => c.classList.remove("current"));
            card.classList.add("current");
          },
        }, numEl, wordEl);
        btn._wordEl = wordEl;
        container.append(btn);
      }
    });
  }

  function updateBlank(qIndex, optIndex, finished) {
    const btn = passageText.querySelector(`.blank[data-n="${qIndex}"]`);
    if (!btn) return;
    const w = btn._wordEl;
    w.textContent = setData.questions[qIndex].options[optIndex];
    btn.classList.add("filled");
    if (!finished) {
      btn.classList.remove("flash");
      void btn.offsetWidth; // 重新觸發動畫
      btn.classList.add("flash");
    }
  }

  updateProgress();
}
