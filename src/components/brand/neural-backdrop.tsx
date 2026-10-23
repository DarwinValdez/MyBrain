import { cn } from "@/lib/cn";

// Fixed coordinates (no randomness) so server and client render identically.
const NODES: [number, number][] = [
  [40, 60], [140, 30], [250, 90], [360, 40], [470, 110], [560, 50],
  [90, 170], [200, 200], [320, 160], [430, 220], [540, 180],
  [30, 280], [150, 300], [270, 270], [390, 320], [510, 290], [590, 340],
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 6], [1, 7], [2, 7], [2, 8], [3, 8], [4, 9], [5, 10],
  [6, 7], [7, 8], [8, 9], [9, 10], [6, 11], [6, 12], [7, 13], [8, 13], [9, 14], [10, 15], [10, 16],
  [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [4, 10], [8, 14],
];

/** Decorative neural-network field. Purely visual; hidden from assistive tech. */
export function NeuralBackdrop({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 620 360"
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none select-none", className)}
      aria-hidden
    >
      <defs>
        <radialGradient id="nb-fade" cx="50%" cy="40%" r="65%">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="nb-mask">
          <rect width="620" height="360" fill="url(#nb-fade)" />
        </mask>
      </defs>
      <g mask="url(#nb-mask)">
        {EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={NODES[a][0]}
            y1={NODES[a][1]}
            x2={NODES[b][0]}
            y2={NODES[b][1]}
            stroke={i % 7 === 0 ? "#a594f9" : "#5fd4c8"}
            strokeOpacity={i % 7 === 0 ? 0.28 : 0.16}
            strokeWidth="0.8"
          />
        ))}
        {NODES.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 2.6 : 1.7} fill={i % 6 === 0 ? "#a594f9" : "#8ae6dc"} fillOpacity={0.55}>
            {i % 4 === 0 ? (
              <animate attributeName="fill-opacity" values="0.25;0.8;0.25" dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
            ) : null}
          </circle>
        ))}
      </g>
    </svg>
  );
}
