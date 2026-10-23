import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-panel/60 backdrop-blur-sm shadow-[inset_0_1px_0_0_rgb(255_255_255/0.03)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  icon,
  action,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-line px-5 py-3.5", className)}>
      <h2 className="flex items-center gap-2 text-sm font-medium text-soft">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}
