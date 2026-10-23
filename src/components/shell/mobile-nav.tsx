import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/logo";
import { ActiveNav } from "@/components/shell/active-nav";
import { NavList } from "@/components/shell/nav-list";

/** Top bar + fixed bottom tab bar on small screens. Seven icons fit at 320px. */
export function MobileNav({ capture }: { capture: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-abyss/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/overview" aria-label="NEXUS home">
          <Wordmark />
        </Link>
        {capture}
      </header>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-line bg-abyss/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <Suspense fallback={<NavList variant="mobile" pathname={null} />}>
          <ActiveNav variant="mobile" />
        </Suspense>
      </nav>
    </>
  );
}
