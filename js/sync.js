// 雲端同步（Supabase）。在 js/config.js 填入 url / anonKey 後啟用。
import { getAttempts, markSynced, mergeRemoteAttempts } from "./store.js";

const cfg = (typeof window !== "undefined" && window.ERP_CLOUD) || {};
export const cloudConfigured = !!(cfg.url && cfg.anonKey);

let client = null;
let session = null;

// 狀態變更通知（UI 訂閱）
const listeners = new Set();
export function onSyncChange(fn) { listeners.add(fn); }
function notify() { listeners.forEach((fn) => fn()); }

export const sync = {
  get client() { return client; },
  get session() { return session; },
  get status() { return !cloudConfigured ? "未設定" : client && session ? "connected" : "offline"; },

  async init() {
    if (!cloudConfigured) return;
    try {
      client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
      const { data } = await client.auth.getSession();
      session = data.session || null;
      client.auth.onAuthStateChange((_evt, s) => { session = s; notify(); });
    } catch (e) {
      console.warn("Supabase 初始化失敗", e);
    }
  },

  async signUp(email, password, displayName) {
    if (!client) throw new Error("雲端未設定");
    const { data, error } = await client.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    session = data.session || null;
    notify();
    return data;
  },

  async signIn(email, password) {
    if (!client) throw new Error("雲端未設定");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
    notify();
    return data;
  },

  async signOut() {
    if (!client) return;
    await client.auth.signOut();
    session = null;
    notify();
  },

  async getDisplayName() {
    if (!client || !session) return null;
    try {
      const { data } = await client.from("profiles").select("display_name").eq("id", session.user.id).single();
      return data?.display_name || session.user.user_metadata?.display_name || null;
    } catch { return session.user.user_metadata?.display_name || null; }
  },

  // 把未同步的本機記錄推上雲端
  async pushPending() {
    if (!client || !session) return;
    const pending = getAttempts().filter((a) => !a.synced);
    if (!pending.length) return;
    const rows = pending.map((a) => ({
      user_id: session.user.id,
      set_id: a.setId,
      set_type: a.setType,
      title: a.title,
      score: a.score,
      total: a.total,
      time_spent: a.timeSpent,
      timed_out: a.timedOut,
      timed: a.timed,
      answers: a.answers,
      created_at: a.createdAt,
    }));
    const { error } = await client.from("attempts").insert(rows);
    if (error) { console.warn("推送失敗", error); notify(); return; }
    markSynced(new Set(pending.map((a) => a.key)));
    notify();
  },

  // 拉取雲端記錄並合併（去重），再推送本機未同步項
  async pull() {
    if (!client || !session) return { added: 0 };
    const { data, error } = await client
      .from("attempts")
      .select("set_id,set_type,title,score,total,time_spent,timed_out,timed,answers,created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) { console.warn("拉取失敗", error); return { added: 0, error }; }
    const remote = (data || []).map((r) => ({
      key: r.set_id + "#" + r.created_at,
      setId: r.set_id,
      setType: r.set_type,
      title: r.title,
      score: r.score,
      total: r.total,
      answers: r.answers || [],
      timeSpent: r.time_spent,
      timedOut: r.timed_out,
      timed: r.timed,
      createdAt: r.created_at,
      synced: true,
    }));
    const added = mergeRemoteAttempts(remote);
    await this.pushPending();
    return { added };
  },
};
