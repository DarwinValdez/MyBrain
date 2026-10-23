import Link from "next/link";
import { NeuralBackdrop } from "@/components/brand/neural-backdrop";
import { Wordmark } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12">
      <NeuralBackdrop className="absolute inset-0 h-full w-full opacity-70" />
      <div className="relative w-full max-w-sm space-y-8">
        <Link href="/" className="flex justify-center" aria-label="NEXUS home">
          <Wordmark />
        </Link>
        <div className="rounded-2xl border border-line-strong bg-deep/85 p-6 shadow-2xl shadow-black/50 backdrop-blur-md sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
