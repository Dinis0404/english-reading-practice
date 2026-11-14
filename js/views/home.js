// 題庫首頁：完形填空 / 閱讀理解 兩個分頁 + 難度與文體篩選
import { el, avatarEl, fmtDate } from "../util.js";
import { loadManifest, getAttempts, bestScoreOf, attemptCountOf, state } from "../store.js";
import { renderTopbar, themeToggleBtn, syncBadge } from "../ui.js";
import { onSyncChange, sync } from "../sync.js";

const TYPE_LABEL = { cloze: "完形填空", reading: "閱讀理解" };

export async function renderHome(ctx) {
  const manifest = await loadManifest();

  let tab = "cloze";
  let filterLv = "全部";
  let filterGenre = "全部";

  const view = document.getElementById("view");
  view.innerHTML = "";

  // ---- 頂部：使用者列 ----
  const badge = syncBadge();
  const refreshBadge = () => {
    if (sync.session) { badge.dot.className = "sync-dot"; badge.label.textContent = "已同步"; }
    else if (sync.client) { badge.dot.className = "sync-dot off"; badge.label.textContent = "未登入"; }
    else { badge.dot.className = "sync-dot off"; badge.label.textContent = "本機模式"; }
  };
  refreshBadge();
  const unsub = onSyncChange(refreshBadge);

  const head = el("div", { class: "home-head" },
    avatarEl(state.profileName, state.profileColor),
    el("div", { class: "who" },
      el("div", { class: "name" }, state.profileName),
      el("div", { class: "sub" }, badge.dot, badge.label),
    ),
    el("button", { class: "btn small secondary", onclick: () => ctx.go("#/history") }, "記錄"),
    el("button", { class: "btn small secondary", onclick: () => ctx.go("#/settings") }, "設定"),
  );
  view.append(head);

  // ---- 分頁 ----
  const tabs = el("div", { class: "tabs" });
  for (const t of ["cloze", "reading"]) {
    tabs.append(el("button", {
      class: "tab" + (t === tab ? " on" : ""),
      onclick: () => { tab = t; filterLv = "全部"; filterGenre = "全部"; paintTabs(); paintFilters(); paintList(); },
    }, TYPE_LABEL[t]));
  }
  tabs.append(el("button", {
    class: "tab",
    style: "flex:0.7",
    onclick: () => ctx.go("#/vocab"),
  }, "📖 背單字"));
  view.append(tabs);

  // ---- 篩選列 ----
  let filterRow;
  function paintFilters() {
    if (filterRow) filterRow.remove();
    const items = manifest[tab];
    const levels = ["全部", ...new Set(items.map((s) => s.level))];
    const genres = ["全部", ...new Set(items.map((s) => s.genre))];
    filterRow = el("div", { class: "filter-row" });
    const mk = (list, cur, setter) => {
      for (const v of list) {
        filterRow.append(el("button", {
          class: "fchip" + (v === cur ? " on" : ""),
          onclick: () => { setter(v); paintFilters(); paintList(); },
        }, v));
      }
    };
    mk(levels, filterLv, (v) => (filterLv = v));
    mk(genres, filterGenre, (v) => (filterGenre = v));
    view.insertBefore(filterRow, listWrap);
  }

  // ---- 題組清單 ----
  const listWrap = el("div", {});
  view.append(listWrap);

  function paintTabs() {
    [...tabs.children].forEach((b, i) => b.classList.toggle("on", (i === 0) === (tab === "cloze")));
  }

  async function paintList() {
    const items = manifest[tab].filter((s) =>
      (filterLv === "全部" || s.level === filterLv) &&
      (filterGenre === "全部" || s.genre === filterGenre));
    listWrap.innerHTML = "";
    if (!items.length) {
      listWrap.append(el("div", { class: "empty" }, "沒有符合篩選條件的題組"));
      return;
    }
    const grid = el("div", { class: "set-list" });
    for (const s of items) {
      const best = bestScoreOf(s.id);
      const count = attemptCountOf(s.id);
      const meta = el("div", { class: "meta" },
        el("span", { class: "chip lv" }, s.level),
        el("span", { class: "chip" }, s.genre),
        el("span", { class: "chip" }, s.style),
        el("span", { class: "chip" }, tab === "cloze" ? `${s.blanks} 空` : `${s.questions} 題`),
        el("span", { class: "chip" }, `建議 ${s.minutes} 分`),
      );
      const bestHtml = count
        ? `已練 ${count} 次 · 最佳 ${best.score}/${best.total}（${Math.round((100 * best.score) / best.total)}%）`
        : "尚未練習";
      grid.append(el("div", { class: "card set-card" },
        el("div", { class: "t" }, s.title),
        meta,
        el("div", { class: "foot" },
          el("span", { class: "best" }, bestHtml),
          el("button", { class: "btn small go", onclick: () => ctx.go(`#/run/${tab}/${s.id}`) }, count ? "再練一次" : "開始練習"),
        ),
      ));
    }
    listWrap.append(grid);
  }

  renderTopbar({
    title: "English Reading Lab",
    left: null,
    right: [themeToggleBtn()],
  });

  paintTabs();
  paintFilters();
  paintList();

  // 離開頁面時取消訂閱
  ctx.onLeave(() => unsub());
}
