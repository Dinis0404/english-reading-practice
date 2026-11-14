// 設定頁：主題、雲端同步、使用說明、資料管理
import { el, toast, confirmDialog, modal } from "../util.js";
import { settings, saveSettings, applyTheme, state, clearLocalHistory, switchToGate } from "../store.js";
import { renderTopbar } from "../ui.js";
import { sync, cloudConfigured } from "../sync.js";

export function renderSettings(ctx) {
  renderTopbar({ title: "設定", back: () => ctx.go("#/home") });
  const view = document.getElementById("view");
  view.innerHTML = "";
  view.classList.add("page-narrow");
  const cleanup = [];
  ctx.onLeave(() => { cleanup.forEach((fn) => fn()); view.classList.remove("page-narrow"); });

  // ---- 深色模式 ----
  const themeSeg = el("div", { class: "seg", style: "width:220px" });
  const themeOpts = [["auto", "跟隨系統"], ["light", "淺色"], ["dark", "深色"]];
  const paintTheme = () => {
    themeSeg.innerHTML = "";
    for (const [val, label] of themeOpts) {
      themeSeg.append(el("button", {
        class: settings.theme === val ? "on" : "",
        onclick: () => { settings.theme = val; saveSettings(); paintTheme(); },
      }, label));
    }
  };
  paintTheme();

  // ---- 帳號 ----
  const accountCard = el("div", { class: "card set-group" });
  if (!cloudConfigured) {
    accountCard.append(
      el("div", { class: "set-row" },
        el("div", { class: "lab" }, "雲端同步", el("span", { class: "hint" }, "尚未設定。填入免費 Supabase 專案資訊後，不同設備可用同一帳號登入並同步成績。")),
      ),
      el("div", { class: "set-row" },
        el("div", { class: "lab" }, `目前身分：${state.profileName}（本機訪客）`),
        el("button", { class: "btn small secondary", onclick: () => { switchToGate(); ctx.go("#/"); } }, "切換使用者"),
      ),
    );
  } else if (sync.session) {
    const email = sync.session.user.email || "";
    accountCard.append(
      el("div", { class: "set-row" },
        el("div", { class: "lab" }, `已登入：${state.profileName}`, el("span", { class: "hint" }, email)),
        el("button", {
          class: "btn small secondary",
          onclick: async () => { await sync.signOut(); switchToGate(); ctx.go("#/"); },
        }, "登出"),
      ),
    );
  } else {
    accountCard.append(
      el("div", { class: "set-row" },
        el("div", { class: "lab" }, "雲端帳號", el("span", { class: "hint" }, "登入後作答記錄自動跨設備同步")),
        el("button", { class: "btn small", onclick: () => { switchToGate(); ctx.go("#/"); } }, "去登入"),
      ),
    );
  }

  // ---- 資料 ----
  const dataCard = el("div", { class: "card set-group" },
    el("div", { class: "set-row" },
      el("div", { class: "lab" }, "清除本設備的作答記錄", el("span", { class: "hint" }, "只清除此使用者的本機記錄，不影響雲端資料")),
      el("button", {
        class: "btn small danger",
        onclick: () => confirmDialog("清除記錄？", "此設備上此使用者的所有作答記錄將被刪除，無法復原。", "清除", () => {
          clearLocalHistory();
          toast("已清除本機記錄");
        }, true),
      }, "清除"),
    ),
  );

  // ---- 使用說明 ----
  const helpCard = el("div", { class: "card set-group" },
    el("button", {
      class: "set-row", style: "width:100%;text-align:left",
      onclick: () => modal({ title: "使用說明", body: helpHtml(), actions: [{ label: "知道了", kind: "" }] }),
    },
      el("div", { class: "lab" }, "📖 使用說明（iPad 操作）"),
    ),
    el("button", {
      class: "set-row", style: "width:100%;text-align:left",
      onclick: () => modal({ title: "雲端同步設定（Supabase）", body: cloudHelpHtml(), actions: [{ label: "知道了", kind: "" }] }),
    },
      el("div", { class: "lab" }, "☁️ 雲端同步設定指南"),
    ),
  );

  view.append(
    el("div", { class: "card set-group" },
      el("div", { class: "set-row" },
        el("div", { class: "lab" }, "深色模式"),
        themeSeg,
      ),
    ),
    accountCard,
    dataCard,
    helpCard,
    el("p", { style: "text-align:center;color:var(--faint);font-size:12px;margin-top:10px" },
      "English Reading Lab · 題庫會持續擴充"),
  );
}

function helpHtml() {
  return `
  <h3>🏠 題庫首頁</h3>
  <ol>
    <li>上方可切換「完形填空 / 閱讀理解」，並依難度、文體篩選。</li>
    <li>每張卡片顯示練習次數與最佳成績，點「開始練習」進入。</li>
  </ol>
  <h3>✍️ 作答</h3>
  <ol>
    <li>進入題組後先選「限時挑戰」或「不限時練習」。</li>
    <li>橫向持 iPad 時為雙欄：左邊文章、右邊題目；直向時文章在上、題目在下。</li>
    <li>完形填空：在右側點選答案，左側文章的空格會即時填入單字；點文章中的空格可跳到對應題目。</li>
    <li>作答中不顯示答案、不能查詞（模擬真實考試）。計時歸零會自動交卷。</li>
  </ol>
  <h3>🔍 復盤解析（完成後）</h3>
  <ol>
    <li>交卷後進入復盤：總分、正確率、用時一目了然。</li>
    <li>逐題顯示你的答案、正確答案與中文解析；完形填空還會列出該空所在的句子。</li>
    <li>左側原文此時開放<b>點詞查義</b>：點任何英文單字即顯示音標與中文釋義。</li>
    <li>可用「只看錯題」篩選，或點「再做一次」重刷。</li>
  </ol>
  <h3>💡 小技巧</h3>
  <ul>
    <li>用 Safari 開啟 → 分享 → 「加入主畫面」，即可像 App 一樣全螢幕使用。</li>
    <li>同一部設備可在首頁右上角「設定 → 切換使用者」建立多個訪客檔案（可加 PIN）。</li>
  </ul>`;
}

function cloudHelpHtml() {
  return `
  <p>雲端同步使用免費的 <b>Supabase</b> 服務（依下列步驟約 5 分鐘完成）：</p>
  <ol>
    <li>到 <code>supabase.com</code> 註冊並建立新專案（免費）。</li>
    <li>專案建立後，進入 <b>SQL Editor</b>，貼上並執行下方 SQL（建立資料表與權限規則）。</li>
    <li>進入 <b>Project Settings → API</b>，複製 <b>Project URL</b> 與 <b>anon public key</b>。</li>
    <li>把這兩項填入網站倉庫的 <code>js/config.js</code>（交由管理者更新網站）。</li>
    <li>建議到 <b>Authentication → Providers → Email</b> 關閉「Confirm email」，註冊即可即時登入。</li>
  </ol>
  <pre>-- 建立資料表（SQL Editor 執行）
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '學習者',
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id text not null,
  set_type text not null,
  title text,
  score int not null,
  total int not null,
  time_spent int not null default 0,
  timed_out boolean default false,
  timed boolean default false,
  answers jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.attempts enable row level security;
create policy "own attempts select" on public.attempts
  for select using (auth.uid() = user_id);
create policy "own attempts insert" on public.attempts
  for insert with check (auth.uid() = user_id);
create policy "own attempts delete" on public.attempts
  for delete using (auth.uid() = user_id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name','學習者'));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();</pre>
  <p>完成後重新整理網站，即可「登入 / 註冊」。每位使用者用自己的 email 註冊，成績各自獨立、跨設備同步。</p>`;
}
