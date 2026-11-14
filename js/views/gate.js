// 使用者入口：訪客檔案選擇 + 雲端登入/註冊
import { el, toast, modal, closeModal, avatarEl, hashPin } from "../util.js";
import { listGuestProfiles, createGuestProfile, enterGuest, enterCloudUser } from "../store.js";
import { sync, cloudConfigured } from "../sync.js";
import { hideTopbar } from "../ui.js";

export function renderGate(ctx) {
  hideTopbar();
  const view = document.getElementById("view");
  view.innerHTML = "";

  const wrap = el("div", { class: "gate-wrap" });
  wrap.append(el("div", { class: "brand" },
    el("div", { class: "logo" }, "📖"),
    el("h1", {}, "English Reading Lab"),
    el("p", {}, "高三水平以上 · 完形填空與閱讀理解練習"),
  ));

  // 訪客檔案清單
  const profiles = listGuestProfiles();
  const listBox = el("div", { class: "pf-list" });
  if (profiles.length) {
    for (const p of profiles) {
      listBox.append(el("button", { class: "pf-item", onclick: () => pickGuest(p, ctx) },
        avatarEl(p.name, p.color, false),
        el("span", { class: "nm" }, p.name),
        el("span", { class: "meta" }, p.pinHash ? "🔒 PIN" : ""),
      ));
    }
  }

  wrap.append(listBox);

  wrap.append(el("button", {
    class: "btn secondary block",
    onclick: () => showCreateProfile(ctx),
  }, "＋ 新增訪客檔案"));

  // 雲端
  if (cloudConfigured) {
    wrap.append(el("button", { class: "btn ghost block", onclick: () => showAuthSheet(ctx) }, "☁️ 雲端帳號登入 / 註冊"));
  } else {
    wrap.append(el("p", {
      style: "text-align:center;font-size:12.5px;color:var(--faint);line-height:1.7",
    }, "目前為本機模式：成績保存在此設備上。\n如需多設備同步，請在「設定」內填入 Supabase 資訊。"));
  }

  view.append(wrap);
}

async function pickGuest(p, ctx) {
  if (p.pinHash) {
    let input;
    modal({
      title: `輸入 ${p.name} 的 PIN`,
      body: input = el("input", { type: "password", maxlength: "6", inputmode: "numeric", placeholder: "PIN 碼", style: "text-align:center;letter-spacing:.4em" }),
      actions: [
        { label: "取消", kind: "secondary" },
        {
          label: "進入", kind: "", dismissable: false,
          fn: async () => {
            const h = await hashPin(input.value || "");
            if (h === p.pinHash) {
              closeModal();
              enterGuest(p);
              ctx.go("#/home");
            } else {
              toast("PIN 錯誤，請重試");
              input.value = "";
              input.focus();
            }
          },
        },
      ],
    });
    setTimeout(() => input.focus(), 80);
  } else {
    enterGuest(p);
    ctx.go("#/home");
  }
}

function showCreateProfile(ctx) {
  let nameIn, pinIn;
  modal({
    title: "新增訪客檔案",
    body: el("div", {},
      el("div", { class: "field" }, el("label", {}, "顯示名稱"), nameIn = el("input", { type: "text", maxlength: "16", placeholder: "例如：小明" })),
      el("div", { class: "field" }, el("label", {}, "PIN 碼（可選，4-6 位數字）"), pinIn = el("input", { type: "password", maxlength: "6", inputmode: "numeric", placeholder: "留空則不設密碼" })),
    ),
    actions: [
      { label: "取消", kind: "secondary" },
      {
        label: "建立並進入", kind: "", dismissable: false,
        fn: async () => {
          const name = (nameIn.value || "").trim();
          if (!name) { toast("請輸入名稱"); return; }
          const pin = (pinIn.value || "").trim();
          const pinHash = pin ? await hashPin(pin) : null;
          const p = createGuestProfile(name, pinHash);
          enterGuest(p);
          closeModal();
          ctx.go("#/home");
        },
      },
    ],
  });
  setTimeout(() => nameIn.focus(), 80);
}

// ---- 雲端登入 / 註冊 ----
function showAuthSheet(ctx) {
  const sheet = el("div", { class: "sheet" });
  let mode = "signin";
  const emailIn = el("input", { type: "email", placeholder: "email@example.com", autocomplete: "email" });
  const passIn = el("input", { type: "password", placeholder: "至少 6 位", autocomplete: "current-password" });
  const nameField = el("div", { class: "field" }, el("label", {}, "顯示名稱"),
    el("input", { type: "text", maxlength: "16", placeholder: "其他人看到的名字" }));
  const nameIn = nameField.querySelector("input");
  const msg = el("div", { style: "font-size:13px;color:var(--bad);min-height:18px;margin-top:4px" });
  const submit = el("button", { class: "btn block" }, "登入");

  const tabs = el("div", { class: "auth-tabs seg" },
    el("button", { class: "on", onclick: () => setMode("signin") }, "登入"),
    el("button", { onclick: () => setMode("signup") }, "註冊"),
  );

  function setMode(m) {
    mode = m;
    [...tabs.children].forEach((b, i) => b.classList.toggle("on", (i === 0) === (m === "signin")));
    nameField.style.display = m === "signup" ? "" : "none";
    submit.textContent = m === "signup" ? "註冊" : "登入";
    msg.textContent = "";
  }

  submit.addEventListener("click", async () => {
    msg.textContent = "";
    const email = emailIn.value.trim(), pass = passIn.value;
    if (!email || !pass) { msg.textContent = "請填寫 email 與密碼。"; return; }
    if (mode === "signup" && pass.length < 6) { msg.textContent = "密碼至少 6 位。"; return; }
    submit.disabled = true; submit.textContent = "處理中…";
    try {
      if (mode === "signup") {
        const displayName = (nameIn.value || "").trim() || email.split("@")[0];
        await sync.signUp(email, pass, displayName);
        if (!sync.session) {
          msg.style.color = "var(--warn)";
          msg.textContent = "註冊成功！請到信箱點擊確認信後再登入。";
          submit.disabled = false; submit.textContent = "註冊";
          return;
        }
      } else {
        await sync.signIn(email, pass);
      }
      const name = await sync.getDisplayName();
      await enterCloudUser(sync.session.user.id, name);
      closeModal();
      try { await sync.pull(); } catch {}
      ctx.onCloudLogin();
    } catch (e) {
      msg.style.color = "var(--bad)";
      msg.textContent = e.message?.replace("Firebase", "Supabase") || "發生錯誤，請重試。";
      submit.disabled = false;
      submit.textContent = mode === "signup" ? "註冊" : "登入";
    }
  });

  sheet.innerHTML = "";
  sheet.append(
    el("div", { class: "sheet-mask", onclick: () => sheet.remove() }),
    el("div", { class: "sheet-panel" },
      el("div", { class: "sheet-head" }, el("div", { class: "sheet-title" }, "雲端帳號"), el("button", { class: "icon-btn", onclick: () => sheet.remove() }, "✕")),
      el("p", { style: "font-size:13px;color:var(--muted);margin:0 0 14px" }, "不同設備以同一帳號登入，作答記錄自動同步。"),
      tabs,
      el("div", { class: "field" }, el("label", {}, "Email"), emailIn),
      el("div", { class: "field" }, el("label", {}, "密碼"), passIn),
      nameField,
      submit,
      msg,
    ),
  );
  document.body.append(sheet);
}
