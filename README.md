# English Reading Lab · 英文閱讀練習

一個純靜態的英文閱讀訓練網站（無後端、無框架、零建構），專為 iPad 使用優化。

**功能**

- 完形填空（四選一，15 空/篇）與閱讀理解（MCQ），難度高三或以上
- 題庫混合參考兩岸三地考試風格（高考 / 學測 / DSE / 通用），原創題目持續擴充
- 背單字：內建「2026-2027 高二英文單字總表」（690 高頻詞彙 + 526 高頻短語），翻卡背誦、四選一測驗、Leitner 三箱進度；閱讀查詞可「＋加入生字本」
- 離線使用：Service Worker 快取全站資產與資料，首次造訪後可離線背單字、做題（建議「加入主畫面」）
- 限時挑戰 / 不限時練習，限時歸零自動交卷
- 手寫記號：Apple Pencil / 手指直接在文章上寫字、畫線、螢光筆（作答與復盤皆可用，按使用者+題組自動保存）
- 作答中不顯示答案、不可查詞（模擬考場）；完成後進入復盤：逐題中文解析 + 空格所在句子 + 點詞查義（內建 5.7 萬詞條英漢詞典，離線詞形還原）
- 錯題篩選、歷史記錄、最佳成績
- 進度備份：一鍵匯出全部使用者成績、手寫記號與背詞進度成 JSON 檔，另一台設備匯入自動合併去重（免帳號搬運）
- 多使用者：本機訪客檔案（可加 PIN）+ Supabase 雲端帳號（跨設備自動同步，站內附設定嚮導）
- 深色模式（跟隨系統/手動）、iPad 直向/橫向雙欄自適應、可加入主畫面當 App 用
- 字型：思源黑體（Noto Sans TC）介面 + 思源襯線（Noto Serif）文章，各設備渲染一致（Google Fonts，離線時自動退回系統字體）

## 本地執行

任何靜態伺服器皆可：

```bash
cd english-reading-practice
python -m http.server 8080
# 打開 http://localhost:8080
```

> 必須透過 http 伺服器開啟（ES modules 不支援 file:// 直接開啟）。

## 部署到 GitHub Pages

1. 建立 GitHub 倉庫並推送本目錄全部內容。
2. 倉庫 Settings → Pages → Build and deployment → Source 選 **Deploy from a branch**，Branch 選 `main` / `(root)`。
3. 約一分鐘後訪問 `https://<用戶名>.github.io/<倉庫名>/`。

## 題庫格式

每題組一個 JSON 檔（`data/cloze/*.json`、`data/reading/*.json`），在 `data/manifest.json` 登記即可。

- 完形填空：`passage` 中以 `[[1]]`…`[[15]]` 標記空格（依出現順序編號）；`questions` 依序給出每空的 `options` / `answer`（0-3）/ `note`（中文解析）。
- 閱讀理解：`passage` 為全文（`\n\n` 分段），`questions` 含 `q` / `options` / `answer` / `note`。
- 詞典：`data/dict.json` 與 `data/forms.json` 由 ECDICT（MIT License）子集生成，重建腳本見 `../tools/build_dict.py`。

## 雲端同步設定（Supabase，可選）

網站預設以「本機訪客模式」完整可用。要開啟跨設備的雲端帳號同步：

1. 到 [supabase.com](https://supabase.com) 免費註冊並建立專案。
2. 進入 **SQL Editor**，執行下方 SQL（建立資料表與安全規則）。
3. 進入 **Project Settings → API**，複製 **Project URL** 與 **anon public key**。
4. 填入 `js/config.js` 的 `window.ERP_CLOUD.url` 與 `anonKey`，推送重新部署。
5. 建議：**Authentication → Providers → Email** 中關閉 *Confirm email*，註冊即可即時登入。

```sql
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
  for each row execute function public.handle_new_user();
```

> 安全說明：`anon key` 為設計上可公開的金鑰，所有資料讀寫均由上方的 Row Level Security 政策限制為「僅本人的資料」。

## 授權

- 網站代碼：MIT
- 詞典資料：源自 [ECDICT](https://github.com/skywind3000/ECDICT)（MIT License）
- 題庫內容：原創，僅供學習使用
