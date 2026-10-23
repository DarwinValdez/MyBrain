import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/logo";
import { ActiveNav } from "@/components/shell/active-nav";
import { NavList } from "@/components/shell/nav-list";

export function Sidebar({ footer, capture }: { footer: ReactNode; capture: ReactNode }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-abyss/85 backdrop-blur-md lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/overview" aria-label="NEXUS home">
          <Wordmark />
        </Link>
      </div>
      <div className="px-3 pb-3">{capture}</div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3">
        <Suspense fallback={<NavList variant="sidebar" pathname={null} />}>
          <ActiveNav variant="sidebar" />
        </Suspense>
      </nav>
      <div className="border-t border-line p-3">{footer}</div>
    </aside>
  );
}
