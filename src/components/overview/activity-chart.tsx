import { formatDate } from "@/lib/format";

/** Bars for memories saved per day. Real data only; zero days render as baseline ticks. */
export function ActivityChart({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  return (
    <figure className="space-y-3">
      <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={`${total} memories saved in the last ${days.length} days`}>
        {days.map((day) => (
          <div
            key={day.date}
            className="group relative flex-1 rounded-sm bg-gradient-to-t from-signal-deep to-signal/80"
            style={{ height: day.count ? `${Math.max(8, (day.count / max) * 100)}%` : "2px", opacity: day.count ? 1 : 0.35 }}
            title={`${formatDate(`${day.date}T00:00:00Z`)}: ${day.count}`}
          />
        ))}
      </div>
      <figcaption className="flex justify-between font-mono text-[10px] text-faint">
        <span>{formatDate(`${days[0]?.date}T00:00:00Z`)}</span>
        <span>{total} saved</span>
        <span>{formatDate(`${days[days.length - 1]?.date}T00:00:00Z`)}</span>
      </figcaption>
    </figure>
  );
}
