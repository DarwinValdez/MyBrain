import Link from "next/link";
import { NAV_ITEMS, isActive } from "@/components/shell/nav-items";
import { cn } from "@/lib/cn";

/** Pure render of the main navigation. `pathname` is null while it streams in. */
export function NavList({ variant, pathname }: { variant: "sidebar" | "mobile"; pathname: string | null }) {
  if (variant === "mobile") {
    return (
      <>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname ? isActive(pathname, href) : false;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-[10px]", active ? "text-signal" : "text-dim")}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="w-full truncate text-center">{label.replace("My ", "").replace("Knowledge ", "")}</span>
            </Link>
          );
        })}
      </>
    );
  }
  return (
    <>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname ? isActive(pathname, href) : false;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-signal-deep/30 text-fg" : "text-dim hover:bg-raised/60 hover:text-soft",
            )}
          >
            {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-signal" aria-hidden /> : null}
            <Icon className={cn("h-4 w-4", active ? "text-signal" : "text-faint group-hover:text-dim")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </>
  );
}
