import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Check, Trash2, Plus, RefreshCw, Lock, Gift, Calendar,
  Key, Users, ChevronDown, ChevronUp, Clock, Send, UserX, CalendarClock,
  LogOut,
} from "lucide-react";
import { useLang } from "@/contexts/lang";

// ── Admin session storage ─────────────────────────────────────────────────────
// We store a SHORT-LIVED SESSION TOKEN (not the raw password) in sessionStorage.
// The raw password is never persisted in the browser after the login call.
const TOKEN_KEY = "phoenix_admin_token";
const TOKEN_EXPIRY_KEY = "phoenix_admin_token_expiry";

function saveAdminToken(token: string, expiresAt: number) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
}

function loadAdminToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (parseInt(expiry, 10) < Date.now()) {
    clearAdminToken();
    return null;
  }
  return token;
}

function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  // Also clean up any legacy raw-password storage
  sessionStorage.removeItem("phoenix_admin_pass");
  sessionStorage.removeItem("enawi_admin_pass");
}

// ─────────────────────────────────────────────────────────────────────────────

const MAX_USES_OPTIONS = [
  { label: "شخص واحد فقط", value: 1 },
  { label: "2 أشخاص", value: 2 },
  { label: "5 أشخاص", value: 5 },
  { label: "10 أشخاص", value: 10 },
  { label: "بدون حد", value: 0 },
];

const UNIT_OPTIONS = [
  { label: "يوم", value: "days" as const },
  { label: "أسبوع", value: "weeks" as const },
  { label: "شهر", value: "months" as const },
];

function daysFromUnit(n: number, unit: "days" | "weeks" | "months"): number {
  if (unit === "weeks") return n * 7;
  if (unit === "months") return n * 30;
  return n;
}

interface GiftEntry {
  code: string;
  label: string;
  createdAt: number;
  usedAt: number | null;
  codeExpiresAt: number | null;
  durationDays: number;
  maxUses: number;
  usedCount: number;
  activeSessions?: number;
  active: boolean;
}
interface GiftsResponse {
  codes: GiftEntry[];
  total: number;
  active: number;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

function buildSubMessage(code: string, durationDays: number, label?: string): string {
  const siteUrl = window.location.origin;
  const dur = (() => {
    if (durationDays % 30 === 0 && durationDays >= 30) return durationDays === 30 ? "شهر" : `${durationDays / 30} أشهر`;
    if (durationDays % 7 === 0 && durationDays >= 7) return durationDays === 7 ? "أسبوع" : `${durationDays / 7} أسابيع`;
    return `${durationDays} يوم`;
  })();
  const greeting = label ? `مرحباً ${label} 🎬` : `مرحباً 🎬`;
  return `${greeting}\nكود اشتراكك في Phoenix Cinema (${dur}):\n\n${code}\n\nافتح الرابط وادخل الكود:\n${siteUrl}`;
}

function TelegramBtn({ code, durationDays, label }: { code: string; durationDays: number; label?: string }) {
  const siteUrl = window.location.origin;
  const text = encodeURIComponent(buildSubMessage(code, durationDays, label));
  return (
    <a
      href={`https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      className="p-1.5 rounded-lg hover:bg-[#229ED9]/15 text-muted-foreground/50 hover:text-[#229ED9] transition-colors"
      title="إرسال عبر تيلجرام"
    >
      <Send size={14} />
    </a>
  );
}

function CopyMsgBtn({ code, durationDays, label }: { code: string; durationDays: number; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(buildSubMessage(code, durationDays, label)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} title="نسخ الرسالة كاملة" className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground/50 hover:text-white transition-colors">
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}س`;
  return `${Math.floor(h / 24)}ي`;
}

function timeLeft(ms: number) {
  const diff = ms - Date.now();
  if (diff <= 0) return "انتهى";
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}ي`;
  const h = Math.floor(diff / 3600000);
  return `${h}س`;
}

function durationLabel(days: number) {
  if (days % 30 === 0 && days >= 30) return days === 30 ? "شهر" : `${days / 30} أشهر`;
  if (days % 7 === 0 && days >= 7) return days === 7 ? "أسبوع" : `${days / 7} أسابيع`;
  return `${days} يوم`;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function Admin() {
  const { isAr } = useLang();

  // ── Auth state ──────────────────────────────────────────────────────────────
  const [password, setPassword] = useState("");
  const [adminToken, setAdminToken] = useState<string | null>(() => loadAdminToken());
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [monthlyCode, setMonthlyCode] = useState<{ code: string; month: string } | null>(null);
  const [gifts, setGifts] = useState<GiftsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Generate form ───────────────────────────────────────────────────────────
  const [genCount, setGenCount] = useState(1);
  const [genLabel, setGenLabel] = useState("");
  const [genDurationNum, setGenDurationNum] = useState(30);
  const [genDurationUnit, setGenDurationUnit] = useState<"days" | "weeks" | "months">("days");
  const [genMaxUses, setGenMaxUses] = useState(1);
  const [genCodeExpiry, setGenCodeExpiry] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generatedLabel, setGeneratedLabel] = useState("");

  const [showUsed, setShowUsed] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [revokingCode, setRevokingCode] = useState<string | null>(null);

  const genDuration = daysFromUnit(genDurationNum, genDurationUnit);

  // ── API helpers ─────────────────────────────────────────────────────────────
  // Uses the admin SESSION TOKEN — never the raw password.
  const apiFetch = useCallback(async (url: string, opts?: RequestInit) => {
    return fetch(url, {
      ...opts,
      headers: {
        ...(opts?.headers ?? {}),
        "Authorization": `Bearer ${adminToken ?? ""}`,
        ...(opts?.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      },
    });
  }, [adminToken]);

  // ── Login: calls server, gets session token — password NOT stored ───────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json() as { ok: boolean; token?: string; expiresAt?: number; error?: string };
      if (res.ok && data.ok && data.token) {
        saveAdminToken(data.token, data.expiresAt ?? Date.now() + 4 * 60 * 60 * 1000);
        setAdminToken(data.token);
        setPassword(""); // clear raw password from state immediately
      } else {
        setAuthError(data.error ?? "كلمة المرور غير صحيحة");
      }
    } catch {
      setAuthError("خطأ في الاتصال");
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    if (adminToken) {
      try {
        await fetch("/api/admin/logout", {
          method: "POST",
          headers: { "Authorization": `Bearer ${adminToken}` },
        });
      } catch {}
    }
    clearAdminToken();
    setAdminToken(null);
    setAuthed(false);
    setMonthlyCode(null);
    setGifts(null);
  };

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async (token?: string) => {
    const useToken = token ?? adminToken;
    if (!useToken) return;
    setLoading(true);
    try {
      const [mRes, gRes] = await Promise.all([
        fetch("/api/subscription/admin-code", { headers: { "Authorization": `Bearer ${useToken}` } }),
        fetch("/api/subscription/gifts", { headers: { "Authorization": `Bearer ${useToken}` } }),
      ]);
      if (mRes.status === 401 || mRes.status === 403 || gRes.status === 401 || gRes.status === 403) {
        clearAdminToken();
        setAdminToken(null);
        setAuthed(false);
        setAuthError("انتهت جلسة الأدمن، أعد تسجيل الدخول");
        setLoading(false);
        return;
      }
      if (mRes.ok) setMonthlyCode(await mRes.json());
      if (gRes.ok) setGifts(await gRes.json());
      setAuthed(true);
    } catch {
      setAuthError("خطأ في الاتصال");
    }
    setLoading(false);
  }, [adminToken]);

  // Auto-load if token exists in session storage
  useEffect(() => {
    if (adminToken) {
      loadData(adminToken);
    }
  }, []); // eslint-disable-line

  // Load data when token changes (after login)
  useEffect(() => {
    if (adminToken && !authed) {
      loadData(adminToken);
    }
  }, [adminToken]); // eslint-disable-line

  // ── Generate codes ──────────────────────────────────────────────────────────
  const generateCodes = async () => {
    setGenerating(true);
    setGeneratedCodes([]);
    try {
      const codeExpiresAt = genCodeExpiry ? new Date(genCodeExpiry + "T23:59:59").getTime() : null;
      const res = await apiFetch("/api/subscription/gifts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: genLabel, count: genCount, durationDays: genDuration, maxUses: genMaxUses, codeExpiresAt }),
      });
      const data = await res.json() as { generated: string[] };
      setGeneratedCodes(data.generated);
      setGeneratedLabel(genLabel);
      setGenLabel("");
      setGenCodeExpiry("");
      await loadData();
    } catch {}
    setGenerating(false);
  };

  const deleteCode = async (code: string) => {
    setDeletingCode(code);
    try {
      await apiFetch(`/api/subscription/gifts/${encodeURIComponent(code)}`, { method: "DELETE" });
      await loadData();
    } catch {}
    setDeletingCode(null);
  };

  const revokeSessions = async (code: string) => {
    setRevokingCode(code);
    try {
      await apiFetch(`/api/subscription/gifts/${encodeURIComponent(code)}/revoke-sessions`, { method: "POST" });
      await loadData();
    } catch {}
    setRevokingCode(null);
  };

  const activeGifts = gifts?.codes.filter(c => c.active) ?? [];
  const usedGifts = gifts?.codes.filter(c => !c.active) ?? [];

  return (
    <div className="flex-1 pt-28 pb-20 px-4 md:px-8" dir="rtl">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Key size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">لوحة الأدمن</h1>
              <p className="text-sm text-muted-foreground">إدارة الاشتراكات والأكواد</p>
            </div>
          </div>
          {authed && (
            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-muted-foreground hover:text-white hover:bg-white/8 text-sm transition-all">
              <LogOut size={14} />
              خروج
            </button>
          )}
        </div>

        {!authed ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-white/[0.04] border border-white/10 p-8 flex flex-col items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Lock size={24} className="text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-white">أدخل كلمة مرور الأدمن</h2>
            <p className="text-xs text-muted-foreground/60 text-center">
              كلمة المرور لا تُخزَّن في المتصفح — فقط رمز جلسة مؤقت
            </p>
            <form onSubmit={handleLogin} className="w-full flex flex-col gap-3">
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setAuthError(""); }}
                placeholder="كلمة المرور"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-primary/50 transition-all text-center font-mono"
                dir="ltr"
                autoComplete="current-password"
              />
              {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
              <button type="submit" disabled={authLoading}
                className="py-3 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold transition-all flex items-center justify-center gap-2">
                {authLoading ? <RefreshCw size={16} className="animate-spin" /> : <Lock size={16} />}
                دخول
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Key, label: "الكود الشهري", value: monthlyCode?.month?.split(" ")[0] ?? "—" },
                { icon: Gift, label: "هدايا فعّالة", value: String(gifts?.active ?? 0) },
                { icon: Users, label: "إجمالي الأكواد", value: String(gifts?.total ?? 0) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl bg-white/[0.04] border border-white/8 p-4 flex flex-col gap-1">
                  <Icon size={14} className="text-primary" />
                  <div className="text-xl font-bold text-white">{value}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
                </div>
              ))}
            </div>

            {/* Monthly code */}
            {monthlyCode && (
              <div className="rounded-2xl border p-5"
                style={{ background: "rgba(220,38,38,0.07)", borderColor: "rgba(220,38,38,0.25)" }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar size={13} />
                    كود {monthlyCode.month} — مشترك لـ 30 يوم
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(`الكود الشهري لـ Phoenix Cinema:\n\n${monthlyCode.code}\n\nصالح لشهر ${monthlyCode.month}\n${window.location.origin}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-[#229ED9]/15 text-muted-foreground/50 hover:text-[#229ED9] transition-colors"
                    >
                      <Send size={14} />
                    </a>
                    <CopyBtn text={monthlyCode.code} />
                  </div>
                </div>
                <div className="font-mono text-3xl font-bold text-white tracking-widest text-center py-2">
                  {monthlyCode.code}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  صالح لأي عدد من الأشخاص — يتجدد تلقائياً كل شهر
                </p>
              </div>
            )}

            {/* Generate gift codes */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Gift size={16} className="text-primary" />
                توليد أكواد هدايا
              </h3>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={genLabel}
                  onChange={e => setGenLabel(e.target.value)}
                  placeholder="اسم المشترك (اختياري)"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white text-sm placeholder:text-white/25 outline-none focus:border-primary/40 transition-all"
                />
                <div className="flex items-center gap-1 bg-white/[0.06] border border-white/10 rounded-xl px-2">
                  <button onClick={() => setGenCount(Math.max(1, genCount - 1))} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-white transition-colors text-lg font-bold">−</button>
                  <span className="w-6 text-center text-white text-sm font-mono font-bold">{genCount}</span>
                  <button onClick={() => setGenCount(Math.min(50, genCount + 1))} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-white transition-colors text-lg font-bold">+</button>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Clock size={11} /> مدة الاشتراك عند تفعيل الكود</p>
                <div className="flex gap-2">
                  <input
                    type="number" min={1} max={3650} value={genDurationNum}
                    onChange={e => setGenDurationNum(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white text-sm font-mono outline-none focus:border-primary/40 transition-all text-center"
                    dir="ltr"
                  />
                  <div className="flex gap-1.5 flex-1">
                    {UNIT_OPTIONS.map(u => (
                      <button key={u.value} onClick={() => setGenDurationUnit(u.value)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${genDurationUnit === u.value ? "bg-primary/20 border-primary/50 text-primary" : "bg-white/[0.04] border-white/10 text-muted-foreground hover:text-white hover:border-white/20"}`}>
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-1.5 text-center">= {genDuration} يوم</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Users size={11} /> عدد الأشخاص المسموح باستخدام الكود</p>
                <div className="flex flex-wrap gap-2">
                  {MAX_USES_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setGenMaxUses(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${genMaxUses === opt.value ? "bg-primary/20 border-primary/50 text-primary" : "bg-white/[0.04] border-white/10 text-muted-foreground hover:text-white hover:border-white/20"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {genMaxUses === 1 && (
                  <p className="text-[11px] text-amber-400/70 mt-1.5 flex items-center gap-1">
                    <span>⚡</span> تسجيل دخول جديد من جهاز آخر سيُلغي الجلسة السابقة
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><CalendarClock size={11} /> آخر تاريخ لتفعيل الكود (اختياري)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date" value={genCodeExpiry} min={todayInputValue()}
                    onChange={e => setGenCodeExpiry(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white text-sm outline-none focus:border-primary/40 transition-all"
                    dir="ltr"
                  />
                  {genCodeExpiry && (
                    <button onClick={() => setGenCodeExpiry("")} className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-muted-foreground hover:text-white text-xs transition-colors">
                      إزالة
                    </button>
                  )}
                </div>
                {genCodeExpiry && (
                  <p className="text-[11px] text-amber-400/60 mt-1.5">⚠ الكود لن يُقبل بعد {new Date(genCodeExpiry).toLocaleDateString("ar")}</p>
                )}
              </div>

              <button onClick={generateCodes} disabled={generating}
                className="w-full px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2">
                {generating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                توليد {genCount > 1 ? `${genCount} أكواد` : "كود"}
              </button>

              <AnimatePresence>
                {generatedCodes.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-green-500/10 border border-green-500/25 p-4 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-green-400 text-xs font-medium">
                        ✓ {generatedCodes.length} كود — {durationLabel(genDuration)} — {genMaxUses === 0 ? "بدون حد" : `${genMaxUses} شخص`}
                      </p>
                      {generatedLabel && (
                        <span className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full">{generatedLabel}</span>
                      )}
                    </div>
                    {generatedCodes.map(code => (
                      <div key={code} className="bg-black/30 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5">
                          <span className="font-mono text-white font-bold tracking-widest text-sm">{code}</span>
                          <div className="flex items-center gap-0.5">
                            <TelegramBtn code={code} durationDays={genDuration} label={generatedLabel || undefined} />
                            <CopyMsgBtn code={code} durationDays={genDuration} label={generatedLabel || undefined} />
                            <CopyBtn text={code} />
                          </div>
                        </div>
                        <div className="px-3 pb-3">
                          <pre className="text-[10px] text-white/40 whitespace-pre-wrap leading-relaxed bg-white/[0.03] rounded-lg px-2.5 py-2 font-sans select-all border border-white/5">
                            {buildSubMessage(code, genDuration, generatedLabel || undefined)}
                          </pre>
                        </div>
                      </div>
                    ))}
                    {generatedCodes.length > 1 && (
                      <button
                        onClick={() => navigator.clipboard.writeText(generatedCodes.join("\n"))}
                        className="w-full mt-1 py-2 text-xs text-green-400 hover:text-green-300 border border-green-500/20 rounded-lg hover:bg-green-500/10 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Copy size={11} /> نسخ كل الأكواد دفعة واحدة
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Active gift codes */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Gift size={15} className="text-primary" />
                  الأكواد الفعّالة
                  {activeGifts.length > 0 && (
                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{activeGifts.length}</span>
                  )}
                </h3>
                <button onClick={() => loadData()} disabled={loading} className="p-2 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-white transition-colors">
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </div>

              {activeGifts.length === 0 ? (
                <div className="px-5 py-8 text-center text-muted-foreground/50 text-sm">لا توجد أكواد فعّالة</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {activeGifts.map(entry => (
                    <div key={entry.code} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-white text-sm font-bold tracking-wider">{entry.code}</span>
                          {entry.label && (
                            <span className="text-[11px] bg-white/8 text-white/60 px-1.5 py-0.5 rounded-full truncate max-w-[80px]">{entry.label}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <TelegramBtn code={entry.code} durationDays={entry.durationDays} label={entry.label || undefined} />
                          <CopyMsgBtn code={entry.code} durationDays={entry.durationDays} label={entry.label || undefined} />
                          <CopyBtn text={entry.code} />
                          <button onClick={() => revokeSessions(entry.code)} disabled={revokingCode === entry.code} title="إلغاء جميع الجلسات (طرد المستخدمين)"
                            className="p-1.5 rounded-lg hover:bg-amber-500/15 text-muted-foreground/40 hover:text-amber-400 transition-colors disabled:opacity-40">
                            {revokingCode === entry.code ? <RefreshCw size={13} className="animate-spin" /> : <UserX size={13} />}
                          </button>
                          <button onClick={() => deleteCode(entry.code)} disabled={deletingCode === entry.code} title="حذف الكود"
                            className="p-1.5 rounded-lg hover:bg-red-500/15 text-muted-foreground/40 hover:text-red-400 transition-colors disabled:opacity-40">
                            {deletingCode === entry.code ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground/50">
                        <span>{durationLabel(entry.durationDays)}</span>
                        <span>·</span>
                        <span>{entry.maxUses === 0 ? "بدون حد" : `${entry.usedCount}/${entry.maxUses} استخدام`}</span>
                        {entry.activeSessions !== undefined && entry.activeSessions > 0 && (
                          <><span>·</span><span className="text-green-400/70">{entry.activeSessions} جلسة نشطة</span></>
                        )}
                        {entry.codeExpiresAt && (
                          <><span>·</span><span className="text-amber-400/60">ينتهي {timeLeft(entry.codeExpiresAt)}</span></>
                        )}
                        <span>·</span>
                        <span>{timeAgo(entry.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Used/expired codes */}
            {usedGifts.length > 0 && (
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
                <button onClick={() => setShowUsed(!showUsed)}
                  className="w-full px-5 py-4 flex items-center justify-between text-muted-foreground hover:text-white transition-colors">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Clock size={14} />
                    الأكواد المستخدمة / المنتهية
                    <span className="text-xs bg-white/8 px-1.5 py-0.5 rounded-full">{usedGifts.length}</span>
                  </span>
                  {showUsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                <AnimatePresence>
                  {showUsed && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <div className="divide-y divide-white/5 border-t border-white/8">
                        {usedGifts.map(entry => (
                          <div key={entry.code} className="px-4 py-3 opacity-50">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-white text-sm font-bold tracking-wider line-through">{entry.code}</span>
                                {entry.label && <span className="text-[11px] bg-white/8 text-white/60 px-1.5 py-0.5 rounded-full">{entry.label}</span>}
                              </div>
                              <button onClick={() => deleteCode(entry.code)} disabled={deletingCode === entry.code}
                                className="p-1.5 rounded-lg hover:bg-red-500/15 text-muted-foreground/40 hover:text-red-400 transition-colors">
                                {deletingCode === entry.code ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                              </button>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground/40">
                              <span>{durationLabel(entry.durationDays)}</span>
                              <span>·</span>
                              <span>{entry.usedCount} استخدام</span>
                              {entry.usedAt && <><span>·</span><span>استُخدم {timeAgo(entry.usedAt)}</span></>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

          </motion.div>
        )}
      </div>
    </div>
  );
}
