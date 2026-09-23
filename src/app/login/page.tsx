"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Building2 } from "lucide-react";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Spinner />}
      تسجيل الدخول
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-gradient-to-b from-accent/40 to-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Building2 className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold">منصة متابعة السكن</h1>
            <p className="text-sm text-muted-foreground">سجّل دخولك لمتابعة يومك</p>
          </div>
        </div>

        <Card className="border-border/60 shadow-xl shadow-black/[0.03]">
          <CardHeader>
            <CardTitle>تسجيل الدخول</CardTitle>
            <CardDescription>استخدم البريد الإلكتروني وكلمة المرور اللي أعطتك إياها الإدارة</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">البريد الإلكتروني</FieldLabel>
                  <Input id="email" name="email" type="email" placeholder="name@example.com" required autoComplete="email" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">كلمة المرور</FieldLabel>
                  <Input id="password" name="password" type="password" required autoComplete="current-password" />
                </Field>
                {state.error && <FieldError>{state.error}</FieldError>}
                <SubmitButton />
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
