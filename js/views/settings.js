// 設定頁：主題、雲端同步、進度備份、使用說明、資料管理
import { el, toast, confirmDialog, modal } from "../util.js";
import { settings, saveSettings, applyTheme, state, clearLocalHistory, switchToGate } from "../store.js";
import { renderTopbar } from "../ui.js";
import { sync, cloudConfigured } from "../sync.js";
import { downloadBackup, importBackupFile } from "../backup.js";

export function renderSettings(ctx) {
  renderTopbar({ title: "設定", back: () => ctx.go("#/home") });
  const view = document.getElementById("view");
  view.innerHTML = "";
  view.classList.add("page-narrow");
  ctx.onLeave(() => view.classList.remove("page-narrow"));

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
        el("div", { class: "lab" }, "雲端同步（自動跨設備）", el("span", { class: "hint" }, "尚未設定。需要一個免費 Supabase 專案；跟著嚮導約 5 分鐘完成，之後不同設備以帳號登入即自動同步。")),
      ),
      el("div", { class: "set-row" },
        el("button", { class: "btn", onclick: openCloudWizard }, "☁️ 雲端同步設定嚮導"),
        el("button", { class: "btn small secondary", style: "margin-left:auto", onclick: () => toast("不用雲端也可以：用下面的「進度備份」手動搬運成績") }, "先跳過"),
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

  // ---- 進度備份（免帳號搬運） ----
  const fileInput = el("input", { type: "file", accept: "application/json,.json", style: "display:none" });
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!f) return;
    try {
      const s = await importBackupFile(f);
      toast(`已匯入：使用者 ${s.profilesAdded} 個、記錄 ${s.attemptsAdded} 筆、記號 ${s.marksAdded} 份`);
    } catch (e) {
      toast("匯入失敗：" + (e.message || "檔案格式不正確"));
    }
  });
  const backupCard = el("div", { class: "card set-group" },
    fileInput,
    el("div", { class: "set-row" },
      el("div", { class: "lab" }, "匯出進度檔案", el("span", { class: "hint" }, "把全部使用者的成績與手寫記號打包成一個 JSON 檔，AirDrop / iCloud / 微信傳到另一台設備")),
      el("button", {
        class: "btn small",
        onclick: () => { downloadBackup(); toast("備份檔已匯出"); },
      }, "匯出"),
    ),
    el("div", { class: "set-row" },
      el("div", { class: "lab" }, "匯入進度檔案", el("span", { class: "hint" }, "選擇備份檔後自動合併（重複記錄不會重複計算，本機已有的記號不會被覆蓋）")),
      el("button", { class: "btn small secondary", onclick: () => fileInput.click() }, "選擇檔案"),
    ),
  );

  // ---- 資料 ----
  const dataCard = el("div", { class: "card set-group" },
    el("div", { class: "set-row" },
      el("div", { class: "lab" }, "清除本設備的作答記錄", el("span", { class: "hint" }, "只清除此使用者的本機記錄，不影響雲端資料；建議先匯出備份")),
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
  );

  view.append(
    el("div", { class: "card set-group" },
      el("div", { class: "set-row" },
        el("div", { class: "lab" }, "深色模式"),
        themeSeg,
      ),
    ),
    accountCard,
    backupCard,
    dataCard,
    helpCard,
    el("p", { style: "text-align:center;color:var(--faint);font-size:12px;margin-top:10px" },
      "English Reading Lab · 題庫會持續擴充"),
  );
}

// ---- 雲端設定嚮導 ----
const SUPABASE_SQL = `create table public.profiles (
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
  for each row execute function public.handle_new_user();`;

function copySql(btn) {
  const done = () => { btn.textContent = "✓ 已複製"; setTimeout(() => (btn.textContent = "📋 複製 SQL"), 1800); };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(SUPABASE_SQL).then(done).catch(() => fallbackCopy(done));
  } else fallbackCopy(done);
}
function fallbackCopy(done) {
  const ta = document.createElement("textarea");
  ta.value = SUPABASE_SQL;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.append(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch { toast("複製失敗，請手動全選 SQL 文字複製"); }
  ta.remove();
}

function openCloudWizard() {
  const body = el("div", { class: "wizard" },
    el("div", { class: "wizard-step" },
      el("div", { class: "wizard-num" }, "1"),
      el("div", {},
        el("b", {}, "建立免費專案："),
        "到 ", el("a", { href: "https://supabase.com", target: "_blank", rel: "noopener", style: "color:var(--accent)" }, "supabase.com"),
        " 註冊並點 New project（免費方案足夠）。", el("span", { class: "wizard-hint" }, "需要你的信箱驗證，所以這一步要你自己來。"),
      ),
    ),
    el("div", { class: "wizard-step" },
      el("div", { class: "wizard-num" }, "2"),
      el("div", {},
        el("b", {}, "執行建表 SQL："),
        "專案頁左側選 SQL Editor → New query，貼上下方 SQL 並按 Run。",
        el("div", { style: "margin-top:8px" },
          el("button", { class: "btn small", onclick: (e) => copySql(e.currentTarget) }, "📋 複製 SQL"),
        ),
        el("pre", { style: "max-height:150px;overflow:auto" }, SUPABASE_SQL),
      ),
    ),
    el("div", { class: "wizard-step" },
      el("div", { class: "wizard-num" }, "3"),
      el("div", {},
        el("b", {}, "取得金鑰："),
        "Project Settings → API，複製 ", el("b", {}, "Project URL"), " 與 ", el("b", {}, "anon public key"),
        "。", el("span", { class: "wizard-hint" }, "anon key 是設計上可公開的金鑰，資料讀寫由 SQL 裡的安全規則限制為「僅本人」。"),
      ),
    ),
    el("div", { class: "wizard-step" },
      el("div", { class: "wizard-num" }, "4"),
      el("div", {},
        el("b", {}, "完成接入："),
        "把這兩個值交給網站管理者填入 ", el("code", {}, "js/config.js"), " 並重新部署。",
        "建議同時到 Authentication → Providers → Email 關閉「Confirm email」，註冊即可即時登入。",
        el("span", { class: "wizard-hint" }, "完成後重新整理網站，入口頁就會出現「雲端帳號登入/註冊」。"),
      ),
    ),
    el("p", { style: "font-size:13px;color:var(--muted);margin-top:12px" },
      "不想設定雲端？用「進度備份」的匯出/匯入也能搬運成績，完全免帳號。"),
  );
  modal({ title: "☁️ 雲端同步設定嚮導", body, actions: [{ label: "知道了", kind: "" }] });
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
  <h3>✏️ 手寫記號（Apple Pencil / 手指）</h3>
  <ol>
    <li>文章欄標題列點「✏️ 記號」開啟畫筆模式，再選原子筆（紅/藍/黑）或螢光筆（黃/綠）。</li>
    <li>直接在文章上寫字、畫線、圈重點；開啟「✍️ 僅 Pencil」可防止手掌誤觸。</li>
    <li>記號模式開啟時文章無法捲動（手指用來畫畫），畫完切回即可正常捲動。</li>
    <li>記號按「使用者 + 題組」自動保存：下次打開同一篇還在，復盤頁也能繼續標註。</li>
  </ol>
  <h3>🔍 復盤解析（完成後）</h3>
  <ol>
    <li>交卷後進入復盤：總分、正確率、用時一目了然。</li>
    <li>逐題顯示你的答案、正確答案與中文解析；完形填空還會列出該空所在的句子。</li>
    <li>左側原文此時開放<b>點詞查義</b>：點任何英文單字即顯示音標與中文釋義。</li>
    <li>可用「只看錯題」篩選，或點「再做一次」重刷。</li>
  </ol>
  <h3>💾 換設備搬運成績</h3>
  <ol>
    <li>設定 → 進度備份 → 「匯出進度檔案」，得到一個 JSON 檔。</li>
    <li>用 AirDrop / iCloud 檔案 / 微信把檔案傳到另一台設備。</li>
    <li>另一台設備同網站 → 設定 → 「匯入進度檔案」選該檔案，自動合併去重。</li>
    <li>想要自動同步（免手動）才需要設定雲端：見「雲端同步設定嚮導」。</li>
  </ol>
  <h3>🃏 背單字</h3>
  <ol>
    <li>首頁點「📖 背單字」進入；先選清單：高頻詞彙 1-599 / 600-690 / 高頻短語 / 我的生字本。</li>
    <li>翻卡背誦：看英文想中文 → 點卡片翻面核對 → 按「懂了 / 不會」。標記不會的詞會優先出現在下輪。</li>
    <li>快速測驗：10 題四選一（英中雙向），錯的詞自動標記為重學。</li>
    <li>閱讀復盤時點單字 → 「＋ 加入生字本」，生字會出現在「我的生字本」一起背。</li>
  </ol>
  <h3>📶 離線使用</h3>
  <ol>
    <li>第一次連網打開網站後，應用會自動快取到本機（幾秒完成）。</li>
    <li>之後開飛行模式也能背單字、翻卡、測驗、做題；記錄存本機，恢復網路後自動補同步。</li>
    <li>建議 Safari「加入主畫面」當 App 用，離線啟動更順。</li>
  </ol>
  <h3>💡 小技巧</h3>
  <ul>
    <li>用 Safari 開啟 → 分享 → 「加入主畫面」，即可像 App 一樣全螢幕使用。</li>
    <li>同一部設備可在首頁右上角「設定 → 切換使用者」建立多個訪客檔案（可加 PIN）。</li>
  </ul>`;
}
