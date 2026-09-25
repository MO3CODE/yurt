"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, HandHeart, BookOpen, SprayCan, ArrowLeft } from "lucide-react";
import { signIn, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { KhatamMark, GeometricPattern } from "@/components/brand/khatam";

const initialState: LoginState = {};

const features = [
  { icon: HandHeart, text: "تابع صلواتك اليومية بلمسة واحدة" },
  { icon: BookOpen, text: "سجّل وردك القرآني وتقدّمك في الحفظ" },
  { icon: SprayCan, text: "جدول النظافة ومهام الشقة في مكان واحد" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="group h-11 w-full text-base" disabled={pending}>
      {pending ? <Spinner /> : null}
      تسجيل الدخول
      {!pending && <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-1" />}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="grid min-h-svh w-full lg:grid-cols-[1.05fr_1fr]">
      {/* لوح الهوية */}
      <aside className="relative isolate hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 -z-10 opacity-[0.09]">
          <GeometricPattern className="text-sidebar-primary" size={64} />
        </div>
        <div className="absolute -bottom-40 -start-40 -z-10 size-[34rem] rounded-full bg-sidebar-primary/20 blur-3xl" aria-hidden />
        <div className="absolute -top-24 end-10 -z-10 size-72 rounded-full bg-primary/30 blur-3xl" aria-hidden />

        <div className="flex items-center gap-3">
          <KhatamMark className="size-11" />
          <span className="font-heading text-xl font-semibold text-sidebar-accent-foreground">منصة السكن</span>
        </div>

        <div className="flex max-w-md flex-col gap-8">
          <h2 className="font-heading text-5xl leading-[1.25] font-semibold text-sidebar-accent-foreground">
            سكنٌ يُعين على
            <br />
            <span className="text-gold-gradient">العلم والعبادة</span>
          </h2>
          <ul className="stagger flex flex-col gap-4">
            {features.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sidebar-foreground/85">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-primary ring-1 ring-sidebar-border">
                  <f.icon className="size-5" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/45">منصة متابعة طلاب السكن — Güzel Eser</p>
      </aside>

      {/* النموذج */}
      <main className="relative flex flex-col items-center justify-center px-6 py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,var(--accent),transparent)] lg:hidden"
        />
        <div className="page-enter relative w-full max-w-sm">
          <div className="mb-10 flex flex-col items-center gap-4 text-center lg:items-start lg:text-start">
            <KhatamMark className="size-14 lg:hidden" />
            <div className="flex flex-col gap-2">
              <h1 className="font-heading text-3xl font-semibold">أهلاً بعودتك</h1>
              <p className="text-sm text-muted-foreground">سجّل دخولك بالبيانات التي أرسلتها لك الإدارة عبر واتساب</p>
            </div>
          </div>

          <form action={formAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">البريد الإلكتروني</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  dir="ltr"
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className="h-11 text-start"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">كلمة المرور</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    required
                    autoComplete="current-password"
                    className="h-11 pl-11 text-start"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    className="absolute inset-y-0 left-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>
              {state.error && <FieldError className="animate-rise">{state.error}</FieldError>}
              <SubmitButton />
            </FieldGroup>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground lg:text-start">
            نسيت كلمة المرور؟ تواصل مع إدارة السكن لإعادة تعيينها.
          </p>
        </div>
      </main>
    </div>
  );
}
