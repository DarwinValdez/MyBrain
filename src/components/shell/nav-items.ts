import { Brain, FolderKanban, LayoutDashboard, Network, Settings, Sparkles, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/memories", label: "My Memories", icon: Brain },
  { href: "/recall", label: "AI Recall", icon: Sparkles },
  { href: "/graph", label: "Knowledge Graph", icon: Network },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
