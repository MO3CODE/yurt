"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { changeTemporaryPassword, type ChangePasswordState } from "./actions";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

const initialState: ChangePasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending}>
      {pending && <Spinner />}
      حفظ كلمة المرور والمتابعة
    </Button>
  );
}

export function ChangePasswordForcedForm() {
  const [state, formAction] = useActionState(changeTemporaryPassword, initialState);
  const [show, setShow] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">كلمة المرور الجديدة</FieldLabel>
            <div className="relative">
              <Input id="password" name="password" type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" className="h-11 pe-10" />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm">تأكيد كلمة المرور</FieldLabel>
            <Input id="confirm" name="confirm" type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" className="h-11" />
          </Field>
          {state.error && <FieldError>{state.error}</FieldError>}
        </FieldGroup>
        <SubmitButton />
      </form>
      <form action={signOut}>
        <Button type="submit" variant="ghost" className="w-full text-muted-foreground">
          تسجيل الخروج
        </Button>
      </form>
    </div>
  );
}
