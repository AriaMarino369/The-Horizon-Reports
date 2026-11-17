import type { AircraftRole } from "@/generated/prisma/client";

/**
 * Generic, hand-drawn side-profile silhouettes used only when no genuine
 * photograph exists for an aircraft or operator — there is no image
 * generation tool available in this project, so a stylized outline (clearly
 * labeled as generic) is the honest fallback rather than a fabricated or
 * wrong-country photo. Shape is derived from role, not the specific type:
 * it is not meant to be an accurate rendering of any one aircraft.
 */
type Shape = "fighter" | "helicopter" | "uav" | "transport" | "trainer" | "airliner";

const ROLE_TO_SHAPE: Record<AircraftRole, Shape> = {
  FIGHTER: "fighter",
  MULTIROLE_FIGHTER: "fighter",
  ATTACK: "fighter",
  TRAINER: "trainer",
  TRANSPORT: "transport",
  HELICOPTER: "helicopter",
  UAV: "uav",
  MARITIME_PATROL: "airliner",
  AEW_C: "airliner",
  TANKER: "airliner",
  OTHER: "trainer",
};

function FighterPath() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M 20 70 L 60 66 L 150 62 L 230 58 L 310 60 L 350 64 L 370 68 L 350 72 L 230 70 L 150 72 L 60 74 Z" />
      <path d="M 150 68 L 110 110 L 160 100 L 200 70" />
      <path d="M 210 68 L 250 100 L 290 108 L 230 70" />
      <path d="M 320 62 L 345 40 L 335 62" />
      <path d="M 320 70 L 335 78 L 345 70" />
    </g>
  );
}

function HelicopterPath() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <line x1="40" y1="46" x2="360" y2="46" />
      <path d="M 90 70 Q 90 50 130 50 L 230 50 Q 260 50 260 70 L 260 90 Q 230 100 150 100 Q 100 98 90 85 Z" />
      <path d="M 230 72 L 320 76 L 320 84 L 232 84" />
      <path d="M 312 70 L 322 56" />
      <line x1="195" y1="50" x2="195" y2="46" />
      <path d="M 110 100 L 100 112 M 230 100 L 230 112 M 95 112 L 240 112" />
    </g>
  );
}

function UavPath() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M 40 70 Q 60 62 120 64 L 300 68 Q 330 69 340 70 Q 330 71 300 72 L 120 76 Q 60 78 40 70 Z" />
      <path d="M 140 66 L 100 40 L 110 65" />
      <path d="M 140 74 L 100 100 L 110 75" />
      <path d="M 300 60 L 330 42 M 300 80 L 330 98" />
      <circle cx="46" cy="70" r="5" />
    </g>
  );
}

function TransportPath() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M 40 80 Q 40 55 80 52 L 260 52 Q 300 54 310 70 Q 300 86 260 88 L 80 88 Q 45 86 40 80 Z" />
      <path d="M 120 54 L 90 20 L 180 20 L 190 54" />
      <path d="M 140 24 L 135 10 L 175 10 L 165 24" />
      <path d="M 300 55 L 340 30 L 335 55" />
      <path d="M 300 85 L 335 85" />
      <circle cx="150" cy="30" r="8" />
      <circle cx="200" cy="30" r="8" />
    </g>
  );
}

function TrainerPath() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M 50 75 Q 50 62 90 60 L 260 62 Q 300 64 320 70 Q 300 76 260 78 L 90 80 Q 52 78 50 75 Z" />
      <path d="M 150 60 Q 165 42 185 42 Q 200 44 195 60" />
      <path d="M 120 62 L 95 95 L 140 90 L 175 62" />
      <path d="M 300 65 L 330 48 M 300 75 L 325 85" />
      <path d="M 90 85 L 85 95 M 150 85 L 150 95" />
    </g>
  );
}

function AirlinerPath() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M 30 72 Q 32 58 70 56 L 300 60 Q 330 62 345 70 Q 330 78 300 80 L 70 84 Q 32 82 30 72 Z" />
      <path d="M 110 62 L 150 20 L 165 20 L 150 64" />
      <path d="M 110 82 L 150 118 L 165 118 L 150 80" />
      <path d="M 300 58 L 335 32 M 300 84 L 330 100" />
      <path d="M 130 58 L 110 45 L 100 58 Z" />
      <path d="M 190 58 L 170 45 L 160 58 Z" />
    </g>
  );
}

const SHAPES: Record<Shape, () => React.JSX.Element> = {
  fighter: FighterPath,
  helicopter: HelicopterPath,
  uav: UavPath,
  transport: TransportPath,
  trainer: TrainerPath,
  airliner: AirlinerPath,
};

export function AircraftSilhouette({ role, className }: { role: AircraftRole; className?: string }) {
  const shape = ROLE_TO_SHAPE[role];
  const Shape = SHAPES[shape];
  return (
    <div className={`flex flex-col items-center justify-center gap-2 bg-panel-2 text-muted ${className ?? ""}`}>
      <svg viewBox="0 0 400 140" className="h-auto w-3/4 max-w-sm opacity-70">
        <Shape />
      </svg>
      <p className="px-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted">
        Generic silhouette — no verified photograph available
      </p>
    </div>
  );
}
