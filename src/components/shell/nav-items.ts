import { Brain, FolderKanban, LayoutDashboard, Mic, Network, Settings, Sparkles, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; short: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", short: "Home", icon: LayoutDashboard },
  { href: "/memories", label: "My Memories", short: "Memories", icon: Brain },
  { href: "/voice", label: "Voice capture", short: "Voice", icon: Mic },
  { href: "/recall", label: "AI Recall", short: "Recall", icon: Sparkles },
  { href: "/graph", label: "Knowledge Graph", short: "Graph", icon: Network },
  { href: "/projects", label: "Projects", short: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
