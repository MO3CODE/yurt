"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { iconMap } from "@/components/nav/icons";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import type { NavGroup, NavItem } from "@/components/nav/nav-config";

export function isActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/app") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNavGroups({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel className="text-[0.7rem] tracking-wide text-sidebar-foreground/50">{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

export function SidebarNavFlat({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = iconMap[item.icon];
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={item.href} onClick={() => isMobile && setOpenMobile(false)} />}
        isActive={active}
        tooltip={item.title}
        className="relative h-9 transition-colors duration-200 before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:scale-y-0 before:rounded-full before:bg-sidebar-primary before:transition-transform before:duration-300 data-active:before:scale-y-100 data-active:[&_svg]:text-sidebar-primary group-data-[collapsible=icon]:before:hidden"
      >
        <Icon />
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
