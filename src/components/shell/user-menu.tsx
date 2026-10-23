import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/account";
import { getAuthContext } from "@/lib/auth";

export async function UserMenu() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { data: profile } = await ctx.supabase.from("profiles").select("display_name").eq("id", ctx.user.id).maybeSingle();
  const name = profile?.display_name || ctx.user.email || "Signed in";
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-pulse/30 bg-pulse-deep/40 font-mono text-xs text-pulse">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-soft">{name}</p>
        {profile?.display_name && ctx.user.email ? <p className="truncate text-xs text-faint">{ctx.user.email}</p> : null}
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-md p-1.5 text-faint transition-colors hover:bg-raised hover:text-soft"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
