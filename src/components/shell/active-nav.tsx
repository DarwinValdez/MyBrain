"use client";

import { usePathname } from "next/navigation";
import { NavList } from "@/components/shell/nav-list";

/** Highlights the current section. Rendered inside <Suspense> because the path is request data. */
export function ActiveNav({ variant }: { variant: "sidebar" | "mobile" }) {
  return <NavList variant={variant} pathname={usePathname()} />;
}
