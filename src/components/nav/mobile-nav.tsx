"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Search, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { iconMap } from "@/components/nav/icons";
import { isActive } from "@/components/nav/sidebar-nav";
import type { NavGroup, NavItem } from "@/components/nav/nav-config";
import { normalizeArabic } from "@/lib/academic";
import { cn } from "@/lib/utils";

// لون أيقونات كل مجموعة في الشبكة (تدور بين ثلاثة ألوان من هوية المنصة)
const TINTS = ["bg-primary/12 text-primary", "bg-gold/20 text-gold-foreground dark:text-gold", "bg-accent text-accent-foreground"];

/**
 * شريط سفلي للجوال: أهم الصفحات بلمسة إبهام حول زر «المزيد» في الوسط،
 * والزر يفتح ورقة سفلية بشبكة كل الأقسام (مع بحث) بدل القائمة الجانبية الطويلة.
 */
export function MobileNav({
  items,
  moreGroups,
  notificationsHref,
  unreadNotifications = 0,
}: {
  items: NavItem[];
  moreGroups: NavGroup[];
  notificationsHref: string;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  // الورقة تُغلق وحدها عند تغيّر الصفحة (زر الرجوع أو الضغط على قسم) دون useEffect
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const [query, setQuery] = useState("");

  // الورقة تعرض كل الأقسام (بما فيها الموجودة في الشريط) ليجد المستخدم كل شيء في مكان واحد
  const groups = moreGroups.filter((g) => g.items.length > 0);

  const q = normalizeArabic(query);
  const shown = groups
    .map((g, index) => ({ ...g, index, items: q ? g.items.filter((i) => normalizeArabic(i.title).includes(q)) : g.items }))
    .filter((g) => g.items.length > 0);

  function setOpen(next: boolean) {
    setOpenedAt(next ? pathname : null);
    if (!next) setQuery("");
  }

  const mid = Math.ceil(items.length / 2);
  const bar = (list: NavItem[]) =>
    list.map((item) => {
      const Icon = iconMap[item.icon];
      const active = isActive(pathname, item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          className="group relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[0.68rem] font-medium"
        >
          <span
            className={cn(
              "absolute inset-0 rounded-xl bg-primary/10 transition-all duration-300 ease-out",
              active ? "scale-100 opacity-100" : "scale-75 opacity-0"
            )}
          />
          <Icon
            className={cn(
              "relative size-5 transition-all duration-300",
              active ? "-translate-y-0.5 text-primary" : "text-muted-foreground group-active:scale-90"
            )}
          />
          <span className={cn("relative transition-colors", active ? "text-primary" : "text-muted-foreground")}>{item.title}</span>
        </Link>
      );
    });

  return (
    <>
      {/* تعتيم الصفحة خلف الورقة؛ الضغط عليه يغلقها */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-[45] bg-black/35 backdrop-blur-[2px] transition-opacity duration-300 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <Drawer
        open={open}
        modal={false}
        showSwipeHandle
        // الإغلاق بالضغط خارج الورقة يتولاه التعتيم وزر الوسط؛ لو أغلقها Base UI هنا ثم عاد الزر فتحها (نقرة واحدة = إغلاق ثم فتح)
        onOpenChange={(next, details) => {
          if (!next && (details.reason === "outside-press" || details.reason === "focus-out")) return;
          setOpen(next);
        }}
      >
        <DrawerContent
          className={cn(
            "md:hidden data-[swipe-axis=y]:inset-x-3 data-[swipe-direction=down]:bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.6rem)]",
            "data-[swipe-direction=down]:rounded-3xl data-[swipe-direction=down]:border [--bleed:0px] shadow-lift"
          )}
        >
          <DrawerHeader className="pt-1 pb-0">
            <DrawerTitle>كل الأقسام</DrawerTitle>
          </DrawerHeader>

          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 [max-height:min(62dvh,30rem)]">
            <label className="flex h-10 shrink-0 items-center gap-2 rounded-xl border bg-card px-3 text-sm text-muted-foreground focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
              <Search className="size-4 shrink-0" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في الأقسام"
                aria-label="ابحث في الأقسام"
                className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>

            {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا يوجد قسم بهذا الاسم</p>}

            {shown.map((g) => (
              <section key={g.label} className="flex flex-col gap-2">
                {groups.length > 1 && <h3 className="text-xs font-medium text-muted-foreground">{g.label}</h3>}
                <ul className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
                  {g.items.map((item) => {
                    const Icon = iconMap[item.icon];
                    const active = isActive(pathname, item.href);
                    const badge = item.href === notificationsHref ? unreadNotifications : 0;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "relative flex h-full flex-col items-center gap-1.5 rounded-2xl border bg-card px-1 py-2.5 text-center text-[0.72rem] leading-snug font-medium transition-all active:scale-95",
                            active && "border-primary/50 bg-primary/[0.06] text-primary"
                          )}
                        >
                          <span className={cn("flex size-9 items-center justify-center rounded-xl", TINTS[g.index % TINTS.length])}>
                            <Icon className="size-5" />
                          </span>
                          {item.title}
                          {badge > 0 && (
                            <span className="absolute top-1.5 start-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] leading-4 font-semibold text-white">
                              {badge > 9 ? "9+" : badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <nav
        aria-label="التنقل السريع"
        className={cn(
          "mobile-nav fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden",
          open ? "z-[55]" : "z-40"
        )}
      >
        <div className="flex items-stretch justify-around rounded-2xl border bg-card/85 p-1.5 shadow-lift backdrop-blur-xl supports-backdrop-filter:bg-card/70">
          {bar(items.slice(0, mid))}

          <div className="relative flex flex-1 flex-col items-center justify-end gap-0.5 py-1.5 text-[0.68rem] font-medium">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-label={open ? "إغلاق قائمة الأقسام" : "كل الأقسام"}
              className="absolute -top-7 flex size-14 items-center justify-center rounded-full bg-sidebar text-sidebar-primary shadow-lift ring-4 ring-background transition-transform duration-300 active:scale-90"
            >
              <LayoutGrid className={cn("absolute size-6 transition-all duration-300", open ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")} />
              <X className={cn("absolute size-6 transition-all duration-300", open ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0")} />
            </button>
            <span aria-hidden className="size-5" />
            <span className={cn("transition-colors", open ? "text-primary" : "text-muted-foreground")}>{open ? "إغلاق" : "المزيد"}</span>
          </div>

          {bar(items.slice(mid))}
        </div>
      </nav>
    </>
  );
}
