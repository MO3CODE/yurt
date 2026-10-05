"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Bell, BellOff, BellRing, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  removePushSubscription,
  saveDevotionReminderSettings,
  savePrayerReminderSettings,
  savePushSubscription,
  sendTestPush,
} from "@/app/app/prayers/push-actions";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { LEAD_OPTIONS, NUDGE_OPTIONS } from "@/lib/prayer-reminders";
import { ADHKAR_OFFSETS, WIRD_OFFSETS, type DevotionSettings } from "@/lib/devotion-reminders";
import { FIVE_PRAYERS, type FivePrayer } from "@/lib/prayer-times";
import { prayerLabel } from "@/lib/date";
import { unwrap } from "@/lib/unwrap";
import { cn } from "@/lib/utils";

type Settings = { leadMinutes: number; nudgeMinutes: number | null; prayers: FivePrayer[] };

/** حالة بيئة الجهاز: لا تتغير أثناء الجلسة، فنقرؤها بلا useEffect */
type Env = "checking" | "unsupported" | "ios-install" | "ready";

function readEnv(): Env {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    return ios && !standalone ? "ios-install" : "unsupported";
  }
  return "ready";
}
const subscribeNone = () => () => {};

function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

const leadLabel = (m: number) => (m === 0 ? "عند الأذان" : `قبل ${m} د`);
const nudgeLabel = (m: number | null) => (m === null ? "بدون" : `بعد ${m} د`);
const OFF = -1;
const adhkarOptions = [{ value: OFF, label: "إيقاف" }, ...ADHKAR_OFFSETS.map((m) => ({ value: m as number, label: `${m} د` }))];
const wirdMinuteOptions = WIRD_OFFSETS.map((m) => ({ value: m as number, label: m === 0 ? "مباشرة" : `${m} د` }));

export function PrayerReminders({
  initial,
  serverReady,
  devotion: initialDevotion,
}: {
  initial: Settings;
  serverReady: boolean;
  /** تذكيرات الأذكار والورد (للطلاب فقط) */
  devotion?: DevotionSettings;
}) {
  const env = useSyncExternalStore(subscribeNone, readEnv, () => "checking" as Env);
  const [subscribed, setSubscribed] = useState<"loading" | "on" | "off">("loading");
  const [denied, setDenied] = useState(false);
  const [settings, setSettings] = useState<Settings>(initial);
  const [devotion, setDevotion] = useState<DevotionSettings | undefined>(initialDevotion);
  const [busy, startBusy] = useTransition();
  const [, startSave] = useTransition();

  useEffect(() => {
    if (env !== "ready") return;
    let alive = true;
    currentSubscription()
      .then((sub) => {
        if (!alive) return;
        setSubscribed(sub ? "on" : "off");
        setDenied(Notification.permission === "denied");
      })
      .catch(() => alive && setSubscribed("off"));
    return () => {
      alive = false;
    };
  }, [env]);

  function enable() {
    startBusy(async () => {
      try {
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!serverReady || !key) throw new Error("الإشعارات غير مفعَّلة على الخادم بعد");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setDenied(permission === "denied");
          throw new Error("لم يُسمح بالإشعارات. فعّلها من إعدادات المتصفح لهذا الموقع");
        }
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) throw new Error("التذكيرات تعمل في النسخة المنشورة من المنصة فقط");
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(key) }));
        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("تعذّر إنشاء اشتراك الإشعارات على هذا الجهاز");
        await unwrap(savePushSubscription({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }));
        await unwrap(savePrayerReminderSettings(settings));
        setSubscribed("on");
        toast.success("تم تفعيل التذكيرات على هذا الجهاز");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر تفعيل التذكيرات");
      }
    });
  }

  function disable() {
    startBusy(async () => {
      try {
        const sub = await currentSubscription();
        if (sub) {
          await unwrap(removePushSubscription(sub.endpoint));
          await sub.unsubscribe();
        }
        setSubscribed("off");
        toast.success("أُوقفت التذكيرات على هذا الجهاز");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر إيقاف التذكيرات");
      }
    });
  }

  function update(patch: Partial<Settings>) {
    const prev = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    startSave(async () => {
      try {
        await unwrap(savePrayerReminderSettings(next));
      } catch (e) {
        setSettings(prev);
        toast.error(e instanceof Error ? e.message : "تعذّر حفظ الإعدادات");
      }
    });
  }

  function updateDevotion(patch: Partial<DevotionSettings>) {
    if (!devotion) return;
    const prev = devotion;
    const next = { ...devotion, ...patch };
    setDevotion(next);
    startSave(async () => {
      try {
        await unwrap(saveDevotionReminderSettings(next));
      } catch (e) {
        setDevotion(prev);
        toast.error(e instanceof Error ? e.message : "تعذّر حفظ الإعدادات");
      }
    });
  }

  function test() {
    startBusy(async () => {
      try {
        const { sent } = await unwrap(sendTestPush());
        toast.success(sent > 1 ? `أُرسل الإشعار إلى ${sent} أجهزة` : "أُرسل الإشعار، يصلك خلال ثوانٍ");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر إرسال الإشعار");
      }
    });
  }

  const on = subscribed === "on";
  const togglePrayer = (p: FivePrayer) =>
    update({
      prayers: settings.prayers.includes(p) ? settings.prayers.filter((x) => x !== p) : FIVE_PRAYERS.filter((x) => x === p || settings.prayers.includes(x)),
    });

  return (
    <section className="@container flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-10 items-center justify-center rounded-xl", on ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}>
            {on ? <BellRing className="size-5" /> : <Bell className="size-5" />}
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-heading font-semibold">{devotion ? "التذكيرات" : "تذكيرات الصلاة"}</span>
            <span className="text-xs text-muted-foreground">
              {on ? "مفعَّلة على هذا الجهاز" : devotion ? "الصلاة والأذكار والورد: إشعار على جهازك" : "إشعار على جهازك عند دخول كل وقت"}
            </span>
          </div>
        </div>

        {env === "ready" && (
          <div className="flex flex-wrap gap-2">
            {on ? (
              <>
                <Button variant="outline" size="sm" onClick={test} disabled={busy}>
                  <Send /> إشعار تجريبي
                </Button>
                <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
                  <BellOff /> إيقاف
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={enable} disabled={busy || subscribed === "loading" || denied}>
                <Bell /> تفعيل التذكيرات
              </Button>
            )}
          </div>
        )}
      </div>

      {env === "ios-install" && (
        <Hint icon={Smartphone}>
          على الآيفون: افتح المنصة في Safari ثم اضغط زر المشاركة واختر «إضافة إلى الشاشة الرئيسية»، وافتحها من الأيقونة الجديدة لتتمكن من تفعيل التذكيرات.
        </Hint>
      )}
      {env === "unsupported" && <Hint icon={BellOff}>هذا المتصفح لا يدعم الإشعارات. جرّب Chrome أو Safari (بعد إضافة المنصة إلى الشاشة الرئيسية).</Hint>}
      {denied && env === "ready" && !on && (
        <Hint icon={BellOff}>الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (أيقونة القفل بجانب العنوان) ثم أعد المحاولة.</Hint>
      )}

      {on && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <Row label="التنبيه">
            <Segmented
              label="وقت التنبيه"
              value={settings.leadMinutes}
              onChange={(v) => update({ leadMinutes: v })}
              options={LEAD_OPTIONS.map((m) => ({ value: m, label: leadLabel(m) }))}
            />
          </Row>
          <Row label="تذكير إن لم أسجّل">
            <Segmented
              label="تذكير بالتسجيل"
              value={settings.nudgeMinutes ?? 0}
              onChange={(v) => update({ nudgeMinutes: v === 0 ? null : v })}
              options={[null, ...NUDGE_OPTIONS].map((m) => ({ value: m ?? 0, label: nudgeLabel(m) }))}
            />
          </Row>
          <Row label="الصلوات">
            <div className="flex flex-wrap gap-1.5">
              {FIVE_PRAYERS.map((p) => {
                const active = settings.prayers.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active}
                    onClick={() => togglePrayer(p)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95",
                      active ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {prayerLabel(p)}
                  </button>
                );
              })}
            </div>
          </Row>
        </div>
      )}

      {on && devotion && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <span className="text-sm font-medium">الأذكار والورد</span>
          <Row label="أذكار الصباح (بعد الفجر)">
            <Segmented
              label="تذكير أذكار الصباح"
              value={devotion.morningMinutes ?? OFF}
              onChange={(v) => updateDevotion({ morningMinutes: v === OFF ? null : v })}
              options={adhkarOptions}
            />
          </Row>
          <Row label="أذكار المساء (بعد العصر)">
            <Segmented
              label="تذكير أذكار المساء"
              value={devotion.eveningMinutes ?? OFF}
              onChange={(v) => updateDevotion({ eveningMinutes: v === OFF ? null : v })}
              options={adhkarOptions}
            />
          </Row>
          <Row label="الورد اليومي (إن لم يكتمل)">
            <Segmented
              label="الصلاة التي بعدها تذكير الورد"
              value={devotion.wirdPrayer ?? "off"}
              onChange={(v) => updateDevotion({ wirdPrayer: v === "off" ? null : (v as FivePrayer) })}
              options={[{ value: "off", label: "إيقاف" }, ...FIVE_PRAYERS.map((p) => ({ value: p as string, label: `بعد ${prayerLabel(p)}` }))]}
            />
          </Row>
          {devotion.wirdPrayer && (
            <Row label="بعد الصلاة بـ">
              <Segmented
                label="دقائق بعد الصلاة"
                value={devotion.wirdMinutes}
                onChange={(v) => updateDevotion({ wirdMinutes: v })}
                options={wirdMinuteOptions}
              />
            </Row>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 @lg:flex-row @lg:items-center @lg:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="max-w-full overflow-x-auto">{children}</div>
    </div>
  );
}

function Hint({ icon: Icon, children }: { icon: typeof Bell; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-sm leading-relaxed text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
