"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, FileSpreadsheet, ListChecks, MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/academic", label: "الطلاب", short: "الطلاب", icon: Users, exact: true },
  { href: "/admin/academic/grades", label: "كشوف الدرجات", short: "الدرجات", icon: FileSpreadsheet },
  { href: "/admin/academic/subjects", label: "المواد المشتركة", short: "المواد", icon: BookOpenCheck },
  { href: "/admin/academic/reminders", label: "تذكيرات واتساب", short: "واتساب", icon: MessageCircle },
  { href: "/admin/academic/plan", label: "الخطة", short: "الخطة", icon: ListChecks },
] as const;

export function AcademicTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="أقسام المتابعة الأكاديمية" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-1 rounded-2xl border bg-card p-1 shadow-soft md:w-fit">
        {TABS.map((t) => {
          const active = "exact" in t ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium sm:gap-2 sm:px-3.5 whitespace-nowrap transition-colors",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <t.icon className="size-4" />
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
