import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, CheckCircle, Loader2, Star, Zap, Shield, Globe, Send, AlertTriangle, Flame, ChevronLeft } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { useFreeTrial, FREE_WATCH_LIMIT } from "@/hooks/use-free-trial";
import { useLang } from "@/contexts/lang";
import { useLocation } from "wouter";

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className="absolute top-4 end-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs font-medium transition-all"
    >
      <Globe size={13} />
      {lang === "ar" ? "English" : "العربية"}
    </button>
  );
}

const PERKS = [
  { icon: Zap, ar: "وصول غير محدود للأفلام والمسلسلات", en: "Unlimited movies & series access" },
  { icon: Globe, ar: "5 مصادر تشغيل مختلفة", en: "5 streaming sources" },
  { icon: Star, ar: "ترجمات تلقائية عربية وإنجليزية", en: "Auto Arabic & English subtitles" },
  { icon: Shield, ar: "بدون إعلانات مزعجة", en: "Ad-free experience" },
];

function translateError(serverError: string, isAr: boolean): string {
  const map: Record<string, [string, string]> = {
    "Code expired":         ["انتهت صلاحية الكود", "Code has expired"],
    "Code already used":    ["الكود استُخدم بالكامل", "Code is fully used"],
    "Invalid or expired code": ["الكود غير صحيح أو منتهي الصلاحية", "Invalid or expired code"],
    "Code is being activated, please try again in a moment": ["الكود يُفعَّل الآن، حاول مجدداً بعد ثانية", "Code is being activated, try again shortly"],
    "Connection error":     ["خطأ في الاتصال بالخادم", "Connection error"],
  };
  const entry = map[serverError];
  if (entry) return isAr ? entry[0] : entry[1];
  return isAr ? "الكود غير صحيح أو منتهي الصلاحية" : "Invalid or expired code";
}

function formatCodeInput(raw: string): string {
  const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (upper.startsWith("G") && upper.length <= 9) {
    const body = upper.slice(1);
    if (body.length <= 4) return body.length ? `G-${body}` : "G";
    return `G-${body.slice(0, 4)}-${body.slice(4, 8)}`;
  }
  if (upper.length <= 4) return upper;
  return `${upper.slice(0, 4)}-${upper.slice(4, 8)}`;
}

function TrialBanner({ onSubscribeClick }: { onSubscribeClick: () => void }) {
  const { remaining, limit } = useFreeTrial();
  const { t } = useLang();
  const isLast = remaining === 1;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
      className={`fixed bottom-[72px] md:bottom-0 inset-x-0 z-40 flex items-center justify-between gap-3 px-4 py-2.5 md:py-2 border-t ${
        isLast
          ? "bg-amber-950/95 border-amber-500/30 backdrop-blur-md"
          : "bg-black/90 border-white/8 backdrop-blur-md"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Flame size={15} className={isLast ? "text-amber-400 shrink-0" : "text-primary shrink-0"} />
        <p className={`text-xs font-medium truncate ${isLast ? "text-amber-200" : "text-white/70"}`}>
          {isLast
            ? t("⚠️ هذه آخر مشاهدة مجانية — اشترك للاستمرار", "⚠️ Last free watch — subscribe to continue")
            : t(`متبقي ${remaining} من ${limit} مشاهدات مجانية`, `${remaining} of ${limit} free watches left`)}
        </p>
      </div>
      <button
        onClick={onSubscribeClick}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
          isLast
            ? "bg-amber-500 hover:bg-amber-400 text-black"
            : "bg-primary hover:bg-primary/90 text-white"
        }`}
      >
        {t("اشترك الآن", "Subscribe Now")}
      </button>
    </motion.div>
  );
}

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { isActive, info, deactivate } = useSubscription();
  const { isTrialActive, isLoading: isTrialLoading } = useFreeTrial();
  const [location] = useLocation();
  const [sessionKicked, setSessionKicked] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    const handler = () => {
      setSessionKicked(true);
      deactivate();
    };
    window.addEventListener("enawi:session-invalidated", handler);
    return () => window.removeEventListener("enawi:session-invalidated", handler);
  }, [deactivate]);

  // Unprotected pages
  if (location === "/admin" || location === "/about") return <>{children}</>;

  // Wait for both subscription and trial status to resolve
  if (isActive === null || isTrialLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  // Fully subscribed — show app with no restrictions
  if (isActive) return <>{children}</>;

  // Free trial still has plays remaining — show app with banner
  if (isTrialActive && !showPaywall) {
    return (
      <>
        {children}
        <TrialBanner onSubscribeClick={() => setShowPaywall(true)} />
      </>
    );
  }

  // Trial exhausted OR user clicked "Subscribe Now" — show paywall
  return (
    <PaywallScreen
      info={info}
      sessionKicked={sessionKicked}
      canGoBack={isTrialActive && showPaywall}
      onGoBack={() => setShowPaywall(false)}
    />
  );
}

function PaywallScreen({
  info,
  sessionKicked,
  canGoBack,
  onGoBack,
}: {
  info: ReturnType<typeof useSubscription>["info"];
  sessionKicked?: boolean;
  canGoBack?: boolean;
  onGoBack?: () => void;
}) {
  const { t, isAr } = useLang();
  const { activate } = useSubscription();

  const [step, setStep] = useState<"main" | "code">("main");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCodeInput(e.target.value);
    setCode(formatted);
    setError("");
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    const result = await activate(code.trim());
    setLoading(false);
    if (result.ok) {
      setSuccess(true);
      setTimeout(() => { window.location.href = "/"; }, 1800);
    } else {
      setError(translateError(result.error ?? "", isAr));
    }
  };

  const paymentUrl = info?.paymentUrl || "";
  const price = info?.price ?? "10";
  const currency = info?.currency ?? "SAR";
  const priceUsd = info?.priceUsd ?? "2.67";

  const codeReady = code.replace(/-/g, "").length >= 6;

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden bg-background"
      dir={isAr ? "rtl" : "ltr"}
    >
      <LangToggle />

      {/* Go-back button when user still has trial plays */}
      {canGoBack && onGoBack && (
        <button
          onClick={onGoBack}
          className="absolute top-4 start-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs font-medium transition-all"
        >
          <ChevronLeft size={13} />
          {t("رجوع", "Back")}
        </button>
      )}

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-primary/4 blur-[80px]" />
      </div>

      {/* Session kicked banner */}
      <AnimatePresence>
        {sessionKicked && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-0 left-0 right-0 flex items-center justify-center gap-2 py-3 px-4 bg-amber-500/15 border-b border-amber-500/25 text-amber-300 text-sm"
          >
            <AlertTriangle size={15} />
            {t(
              "تم تسجيل الدخول من جهاز آخر — جلستك انتهت",
              "Signed in from another device — your session has ended"
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 w-full max-w-md mx-auto px-5">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                <CheckCircle size={40} className="text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                {t("تم التفعيل بنجاح!", "Activated!")}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t("جاري التحميل...", "Loading your experience...")}
              </p>
            </motion.div>
          ) : step === "main" ? (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45 }}
              className="flex flex-col items-center"
            >
              {/* Logo */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-primary/30">
                  <img src="/logo.png" alt="" className="w-full h-full object-cover" style={{ objectPosition: "50% 38%" }} />
                </div>
                <span className="font-serif text-2xl font-bold text-white">
                  Phoenix<span className="text-gradient-red italic">Cinema</span>
                </span>
              </div>

              {/* Lock badge */}
              <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-5 shadow-lg shadow-primary/10">
                <Lock size={28} className="text-primary" />
              </div>

              <h1 className="text-2xl font-bold text-white text-center mb-2">
                {t("اشترك للوصول الكامل", "Subscribe for Full Access")}
              </h1>
              <p className="text-muted-foreground text-sm text-center mb-6 max-w-xs leading-relaxed">
                {t(
                  "احصل على وصول غير محدود لجميع الأفلام والمسلسلات",
                  "Get unlimited access to all movies & series"
                )}
              </p>

              {/* Price card */}
              <div
                className="w-full rounded-2xl p-5 mb-6 relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, rgba(220,38,38,0.18) 0%, rgba(220,38,38,0.06) 100%)",
                  border: "1px solid rgba(220,38,38,0.3)",
                }}
              >
                <div className="flex items-end justify-center gap-1 mb-1">
                  <span className="text-4xl font-black text-white">{price}</span>
                  <span className="text-xl font-bold text-primary mb-1">{currency}</span>
                </div>
                <p className="text-center text-muted-foreground text-xs">
                  {t(`/ شهر (~$${priceUsd})`, `/ month (~$${priceUsd})`)}
                </p>
              </div>

              {/* Perks */}
              <div className="w-full space-y-2.5 mb-7">
                {PERKS.map(({ icon: Icon, ar, en }, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <Icon size={12} className="text-primary" />
                    </div>
                    <span className="text-sm text-white/70">{isAr ? ar : en}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="w-full flex flex-col gap-3">
                <a
                  href={`https://t.me/ABOOD093A?text=${encodeURIComponent("أريد الاشتراك في Phoenix Cinema — أرجو إرسال تفاصيل الاشتراك")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-base transition-all hover:scale-[1.02] shadow-lg shadow-primary/30 active:scale-95"
                >
                  <Send size={17} />
                  {t("اطلب تفاصيل الاشتراك عبر تيلجرام", "Request Subscription Details via Telegram")}
                </a>
                <button
                  onClick={() => { setStep("code"); setTimeout(() => inputRef.current?.focus(), 200); }}
                  className="w-full py-3 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/80 font-medium text-sm transition-all"
                >
                  {t("عندي كود تفعيل ←", "I have an activation code →")}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0, x: isAr ? -30 : 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isAr ? 30 : -30 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-5">
                <Lock size={24} className="text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white text-center mb-2">
                {t("أدخل كود التفعيل", "Enter Activation Code")}
              </h2>
              <p className="text-muted-foreground text-sm text-center mb-6">
                {t(
                  "الكود يُرسل لك بعد إتمام الدفع",
                  "You receive the code after completing payment"
                )}
              </p>

              <form onSubmit={handleActivate} className="w-full flex flex-col gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder={t("XXXX-XXXX أو G-XXXX-XXXX", "XXXX-XXXX or G-XXXX-XXXX")}
                  maxLength={12}
                  className="w-full text-center text-xl font-mono tracking-[0.2em] px-4 py-4 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder:text-white/20 outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                />
                <AnimatePresence>
                  {error && (
                    <motion.p
                      key="err"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-400 text-sm text-center"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
                <button
                  type="submit"
                  disabled={loading || !codeReady}
                  className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={17} className="animate-spin" /> {t("جاري التحقق...", "Verifying...")}</>
                  ) : (
                    t("تفعيل ←", "Activate →")
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("main"); setError(""); setCode(""); }}
                  className="text-sm text-muted-foreground hover:text-white/70 transition-colors py-1"
                >
                  {t("→ رجوع", "← Back")}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
