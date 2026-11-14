// 歷史記錄：過去作答列表，點擊進入復盤
import { el, fmtDate, fmtDuration } from "../util.js";
import { getAttempts, loadManifest } from "../store.js";
import { renderTopbar } from "../ui.js";

const TYPE_LABEL = { cloze: "完形", reading: "閱讀" };

export async function renderHistory(ctx) {
  renderTopbar({ title: "我的記錄", back: () => ctx.go("#/home") });
  const view = document.getElementById("view");
  view.innerHTML = "";

  const attempts = getAttempts();
  if (!attempts.length) {
    view.append(el("div", { class: "empty" }, "還沒有作答記錄，去題庫開始第一篇吧！"));
    return;
  }

  const list = el("div", { class: "card" });
  for (const a of attempts.slice(0, 100)) {
    const pct = Math.round((100 * a.score) / a.total);
    const cls = pct >= 80 ? "good" : pct >= 60 ? "mid" : "bad";
    list.append(el("button", {
      class: "hist-item", style: "width:100%;text-align:left",
      onclick: () => ctx.go(`#/review/${a.setType}/${a.setId}/${encodeURIComponent(a.key)}`),
    },
      el("div", { class: "info" },
        el("div", { class: "t" }, a.title || a.setId),
        el("div", { class: "s" },
          `${TYPE_LABEL[a.setType] || a.setType} · ${fmtDate(a.createdAt)} · 用時 ${fmtDuration(a.timeSpent)}`,
          a.timedOut ? " · 超時" : "",
        ),
      ),
      el("span", { class: "sc " + cls }, `${a.score}/${a.total}`),
    ));
  }
  view.append(list);
}
