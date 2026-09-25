"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Search, Sun, UserRound } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { iconMap } from "@/components/nav/icons";
import type { NavGroup } from "@/components/nav/nav-config";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type StudentHit = { id: string; full_name: string };

export function CommandMenu({ groups, searchStudents = false }: { groups: NavGroup[]; searchStudents?: boolean }) {
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<StudentHit[] | null>(null);
  const fetchedRef = useRef(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // نجلب قائمة الطلاب مرة واحدة عند أول فتح فقط (سواء بالزر أو بالاختصار)
  useEffect(() => {
    if (!open || !searchStudents || fetchedRef.current) return;
    fetchedRef.current = true;
    createClient()
      .from("profiles")
      .select("id, full_name")
      .eq("role", "student")
      .order("full_name")
      .then(({ data }) => setStudents(data ?? []));
  }, [open, searchStudents]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex h-9 items-center gap-2 rounded-xl border bg-card/70 px-3 text-sm text-muted-foreground shadow-soft transition-colors",
          "hover:border-primary/30 hover:text-foreground md:w-64"
        )}
      >
        <Search className="size-4" />
        <span className="hidden md:inline">بحث سريع…</span>
        <Kbd className="ms-auto hidden md:inline-flex" dir="ltr">
          Ctrl K
        </Kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} title="بحث سريع" description="انتقل لأي صفحة أو ابحث عن طالب">
        <Command>
        <CommandInput placeholder="اكتب اسم صفحة أو طالب…" />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>لا توجد نتائج</CommandEmpty>

          {searchStudents && students && students.length > 0 && (
            <>
              <CommandGroup heading="الطلاب">
                {students.map((s) => (
                  <CommandItem key={s.id} value={`طالب ${s.full_name}`} onSelect={() => go(`/admin/students/${s.id}`)}>
                    <UserRound />
                    {s.full_name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {groups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => {
                const Icon = iconMap[item.icon];
                return (
                  <CommandItem key={item.href} value={`${group.label} ${item.title}`} onSelect={() => go(item.href)}>
                    <Icon />
                    {item.title}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}

          <CommandSeparator />
          <CommandGroup heading="الإعدادات">
            <CommandItem
              value="الوضع الليلي النهاري المظهر"
              onSelect={() => {
                setTheme(resolvedTheme === "dark" ? "light" : "dark");
                setOpen(false);
              }}
            >
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              {resolvedTheme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
            </CommandItem>
            <CommandItem value="الملف الشخصي كلمة المرور" onSelect={() => go("/profile")}>
              <UserRound />
              الملف الشخصي
            </CommandItem>
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
