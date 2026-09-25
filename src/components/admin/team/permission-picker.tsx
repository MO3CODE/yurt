"use client";

import { useState } from "react";
import { Check, Crown, UserCog } from "lucide-react";
import { PERMISSION_GROUPS, PERMISSION_PRESETS, type PermissionKey } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type StaffRole = "admin" | "super_admin";

/**
 * اختيار الدور والصلاحيات داخل نموذج؛ يرسل القيم كحقول مخفية
 * (role + permissions متعددة) لتقرأها الـ Server Action من FormData.
 */
export function PermissionPicker({
  defaultRole = "admin",
  defaultPermissions = [],
  lockRole = false,
}: {
  defaultRole?: StaffRole;
  defaultPermissions?: PermissionKey[];
  /** يمنع تغيير الدور (مثلاً المدير العام يعدّل حسابه) */
  lockRole?: boolean;
}) {
  const [role, setRole] = useState<StaffRole>(defaultRole);
  const [selected, setSelected] = useState<Set<PermissionKey>>(new Set(defaultPermissions));

  function toggle(key: PermissionKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isSuper = role === "super_admin";

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="role" value={role} />
      {!isSuper && [...selected].map((k) => <input key={k} type="hidden" name="permissions" value={k} />)}

      {/* الدور */}
      <div role="radiogroup" aria-label="الدور" className="grid grid-cols-2 gap-2">
        {(
          [
            { value: "admin", label: "إداري", hint: "صلاحيات محددة", icon: UserCog },
            { value: "super_admin", label: "مدير عام", hint: "كل الصلاحيات + إدارة الفريق", icon: Crown },
          ] as const
        ).map((r) => {
          const active = role === r.value;
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={lockRole && !active}
              onClick={() => setRole(r.value)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-start transition-all active:scale-[0.98] disabled:opacity-40",
                active ? "border-primary/50 bg-primary/[0.06] ring-1 ring-primary/30" : "hover:border-primary/25"
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <r.icon className="size-4" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-medium">{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {isSuper ? (
        <p className="rounded-xl bg-gold/10 p-3 text-sm text-gold-foreground dark:text-gold">
          المدير العام يملك كل الصلاحيات تلقائياً، ويستطيع إضافة الإداريين وتعديل صلاحياتهم.
        </p>
      ) : (
        <>
          {/* قوالب جاهزة */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">قوالب سريعة</span>
            <div className="flex flex-wrap gap-1.5">
              {PERMISSION_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSelected(new Set(p.permissions))}
                  className="rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/[0.05] hover:text-primary active:scale-95"
                >
                  {p.label}
                </button>
              ))}
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  مسح الكل
                </button>
              )}
            </div>
          </div>

          {/* الصلاحيات حسب الأقسام */}
          <div className="flex max-h-[42vh] flex-col gap-3 overflow-y-auto pe-1">
            {PERMISSION_GROUPS.map((group) => (
              <fieldset key={group.label} className="flex flex-col gap-1.5">
                <legend className="mb-1 text-xs font-medium text-muted-foreground">{group.label}</legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {group.items.map((item) => {
                    const on = selected.has(item.key);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggle(item.key)}
                        className={cn(
                          "flex items-start gap-2.5 rounded-xl border p-2.5 text-start transition-all active:scale-[0.98]",
                          on ? "border-primary/40 bg-primary/[0.05]" : "hover:border-primary/25"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-input"
                          )}
                        >
                          {on && <Check className="size-3" />}
                        </span>
                        <span className="flex flex-col leading-snug">
                          <span className="text-sm font-medium">{item.label}</span>
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {selected.size === 0 ? "لم تُختر أي صلاحية بعد" : `${selected.size} صلاحية مختارة`}
          </p>
        </>
      )}
    </div>
  );
}
