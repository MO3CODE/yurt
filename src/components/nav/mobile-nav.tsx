"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { iconMap } from "@/components/nav/icons";
import { isActive } from "@/components/nav/sidebar-nav";
import type { NavItem } from "@/components/nav/nav-config";
import { cn } from "@/lib/utils";

/** شريط سفلي للجوال: أهم الصفحات بلمسة إبهام، و«المزيد» يفتح القائمة الكاملة */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { setOpenMobile, openMobile } = useSidebar();

  return (
    <nav
      aria-label="التنقل السريع"
      className="mobile-nav fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden"
    >
      <div className="flex items-stretch justify-around rounded-2xl border bg-card/85 p-1.5 shadow-lift backdrop-blur-xl supports-backdrop-filter:bg-card/70">
        {items.map((item) => {
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
              <span className={cn("relative transition-colors", active ? "text-primary" : "text-muted-foreground")}>
                {item.title}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(!openMobile)}
          className="group relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[0.68rem] font-medium text-muted-foreground"
        >
          <Menu className="relative size-5 transition-transform group-active:scale-90" />
          <span>المزيد</span>
        </button>
      </div>
    </nav>
  );
}
