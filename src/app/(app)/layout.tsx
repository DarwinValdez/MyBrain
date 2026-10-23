import { Suspense } from "react";
import { MobileNav } from "@/components/shell/mobile-nav";
import { QuickCapture } from "@/components/shell/quick-capture";
import { Sidebar } from "@/components/shell/sidebar";
import { UserMenu } from "@/components/shell/user-menu";
import { Skeleton } from "@/components/ui/states";

/**
 * Shell for every signed-in page. The proxy redirects signed-out visitors, and
 * each page also calls requireUser() on the server before reading data.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Sidebar
        capture={<QuickCapture />}
        footer={
          <Suspense fallback={<Skeleton className="h-8 w-full" />}>
            <UserMenu />
          </Suspense>
        }
      />
      <MobileNav capture={<QuickCapture compact />} />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">{children}</div>
      </main>
    </div>
  );
}
