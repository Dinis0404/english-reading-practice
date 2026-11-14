// 進度備份：匯出/匯入 JSON 檔，免帳號即可把成績與記號搬到另一台設備
// 涵蓋：訪客檔案、各使用者作答記錄（本機 + 雲端命名空間）、手寫記號。
const APP_ID = "english-reading-lab";
const VERSION = 1;
const MAX_ATTEMPTS = 300;

// ---- 收集 ----
export function collectBackup() {
  const profiles = JSON.parse(localStorage.getItem("erp_profiles") || "[]");
  const attempts = {};
  const marks = {};
  const vocab = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("erp_data_") || key.startsWith("erp_cloud_")) {
      try {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(list) && list.length) attempts[key] = list;
      } catch {}
    } else if (key.startsWith("erp_marks__")) {
      try {
        const val = JSON.parse(localStorage.getItem(key));
        if (val && val.strokes?.length) marks[key] = val;
      } catch {}
    } else if (key.startsWith("erp_vocab_")) {
      try {
        const val = JSON.parse(localStorage.getItem(key));
        if (val && (Array.isArray(val) ? val.length : Object.keys(val).length)) vocab[key] = val;
      } catch {}
    }
  }
  return {
    app: APP_ID,
    v: VERSION,
    exportedAt: new Date().toISOString(),
    data: { profiles, attempts, marks, vocab },
  };
}

// ---- 下載 ----
export function downloadBackup() {
  const obj = collectBackup();
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  a.download = `english-reading-lab-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
  a.href = url;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return obj;
}

// ---- 匯入（智慧合併、去重） ----
export function importBackupObject(obj) {
  if (!obj || obj.app !== APP_ID || Number(obj.v) !== VERSION) {
    throw new Error("不是本網站的備份檔（或版本不符）");
  }
  const data = obj.data || {};
  const summary = { profilesAdded: 0, attemptsAdded: 0, marksAdded: 0, vocabAdded: 0 };

  // 訪客檔案：id 不存在才新增
  if (Array.isArray(data.profiles)) {
    const existing = JSON.parse(localStorage.getItem("erp_profiles") || "[]");
    const ids = new Set(existing.map((p) => p.id));
    for (const p of data.profiles) {
      if (p && p.id && !ids.has(p.id)) {
        existing.push(p);
        ids.add(p.id);
        summary.profilesAdded++;
      }
    }
    localStorage.setItem("erp_profiles", JSON.stringify(existing));
  }

  // 作答記錄：依 attempt.key 去重，各命名空間排序、限量
  if (data.attempts && typeof data.attempts === "object") {
    for (const [nsKey, incoming] of Object.entries(data.attempts)) {
      if (!Array.isArray(incoming)) continue;
      const local = JSON.parse(localStorage.getItem(nsKey) || "[]");
      const keys = new Set(local.map((a) => a.key));
      for (const a of incoming) {
        if (a && a.key && !keys.has(a.key)) {
          local.push({ ...a, synced: !!a.synced });
          keys.add(a.key);
          summary.attemptsAdded++;
        }
      }
      local.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
      localStorage.setItem(nsKey, JSON.stringify(local.slice(0, MAX_ATTEMPTS)));
    }
  }

  // 手寫記號：key 不存在才加入（不覆蓋本機已畫的）
  if (data.marks && typeof data.marks === "object") {
    for (const [mKey, val] of Object.entries(data.marks)) {
      if (!localStorage.getItem(mKey) && val && Array.isArray(val.strokes)) {
        localStorage.setItem(mKey, JSON.stringify(val));
        summary.marksAdded++;
      }
    }
  }

  // 背單字進度/生字本：逐詞合併——本地沒有的照收，衝突取箱數較高（進度較遠）的一方
  if (data.vocab && typeof data.vocab === "object") {
    for (const [vKey, incoming] of Object.entries(data.vocab)) {
      let raw;
      try { raw = JSON.parse(localStorage.getItem(vKey) || "null"); } catch { raw = null; }
      if (!raw) {
        localStorage.setItem(vKey, JSON.stringify(incoming));
        summary.vocabAdded++;
        continue;
      }
      if (Array.isArray(raw) && Array.isArray(incoming)) {
        // 自訂生字本陣列：按 id 去重合併
        const ids = new Set(raw.map((x) => x.id));
        let added = 0;
        for (const item of incoming) {
          if (item && !ids.has(item.id)) { raw.push(item); ids.add(item.id); added++; }
        }
        if (added) {
          localStorage.setItem(vKey, JSON.stringify(raw));
          summary.vocabAdded += added;
        }
      } else if (raw && typeof raw === "object") {
        // 背詞進度物件：逐詞取 box 較高者
        let added = 0;
        for (const [uid, st] of Object.entries(incoming)) {
          const local = raw[uid];
          if (!local) { raw[uid] = st; added++; }
          else if ((st.box || 0) > (local.box || 0)) { raw[uid] = st; added++; }
        }
        if (added) {
          localStorage.setItem(vKey, JSON.stringify(raw));
          summary.vocabAdded += added;
        }
      }
    }
  }

  return summary;
}

// ---- 檔案匯入入口 ----
export function importBackupFile(file) {
  return file.text()
    .then((text) => importBackupObject(JSON.parse(text)));
}
