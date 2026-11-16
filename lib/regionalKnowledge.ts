import type { AirbaseType, AirbaseUnitCategory, AircraftRole, WeaponCategory } from "@/generated/prisma/client";

export const REGIONAL_KNOWLEDGE_COUNTRIES = [
  "Singapore",
  "Indonesia",
  "Brunei",
  "Philippines",
  "Vietnam",
  "Cambodia",
  "Thailand",
  "Malaysia",
  "Laos",
  "Myanmar",
  "Timor-Leste",
  "South China Sea",
] as const;

export const AIRCRAFT_ROLE_LABELS: Record<AircraftRole, string> = {
  FIGHTER: "Fighter",
  MULTIROLE_FIGHTER: "Multirole Fighter",
  ATTACK: "Attack",
  TRANSPORT: "Transport",
  HELICOPTER: "Helicopter",
  UAV: "UAV",
  TRAINER: "Trainer",
  MARITIME_PATROL: "Maritime Patrol",
  AEW_C: "Airborne Early Warning & Control",
  TANKER: "Tanker",
  OTHER: "Other",
};

export const WEAPON_CATEGORY_LABELS: Record<WeaponCategory, string> = {
  AIR_TO_AIR_MISSILE: "Air-to-Air Missile",
  AIR_TO_GROUND_MISSILE: "Air-to-Ground Missile",
  ANTI_SHIP_MISSILE: "Anti-Ship Missile",
  SURFACE_TO_AIR_MISSILE: "Surface-to-Air Missile",
  BOMB: "Bomb",
  ROCKET: "Rocket",
  GUN_CANNON: "Gun / Cannon",
  OTHER: "Other",
};

export const AIRBASE_TYPE_LABELS: Record<AirbaseType, string> = {
  MILITARY: "Military",
  CIVIL_MILITARY_SHARED: "Civil/Military Shared",
};

export const AIRBASE_UNIT_CATEGORY_LABELS: Record<AirbaseUnitCategory, string> = {
  FIGHTER_SQUADRON: "Fighter Squadron",
  TRANSPORT_SQUADRON: "Transport Squadron",
  HELICOPTER_SQUADRON: "Helicopter Squadron",
  UAV_SQUADRON: "UAV Squadron",
  AIR_DEFENSE: "Air Defence",
  SUPPORT: "Support",
  AMMUNITION_DEPOT: "Ammunition Depot",
  OTHER: "Other",
};

export const AIRBASE_UNIT_CATEGORIES: AirbaseUnitCategory[] = [
  "FIGHTER_SQUADRON",
  "TRANSPORT_SQUADRON",
  "HELICOPTER_SQUADRON",
  "UAV_SQUADRON",
  "AIR_DEFENSE",
  "SUPPORT",
  "AMMUNITION_DEPOT",
  "OTHER",
];

/** True if any of an airbase's units represent a flying squadron (vs. a ground-only installation). */
const FLYING_CATEGORIES: AirbaseUnitCategory[] = [
  "FIGHTER_SQUADRON",
  "TRANSPORT_SQUADRON",
  "HELICOPTER_SQUADRON",
  "UAV_SQUADRON",
];
export function hasFlyingUnit(categories: AirbaseUnitCategory[]): boolean {
  return categories.some((c) => FLYING_CATEGORIES.includes(c));
}

/**
 * One SEA operator of a MilitaryAircraft (parsed from its operatorsInRegion
 * JSON). `description`/`imageUrl` are optional per-operator overrides — set
 * when the same real-world aircraft type is operated by multiple countries,
 * so a country's own squadron markings/service details can be shown instead
 * of whichever country's photo happens to be the record's generic default.
 */
export type AircraftOperator = {
  country: string;
  variant?: string;
  approxCount?: number;
  notes?: string;
  description?: string;
  imageUrl?: string | null;
  /**
   * True once this operator has been through the country-specific
   * verification pass — i.e. its description/imageUrl are deliberate,
   * checked results (imageUrl: null here means "confirmed no genuine photo
   * of this country's own aircraft exists," not "nobody looked yet").
   */
  researched?: boolean;
};

export function parseOperators(operatorsInRegion: string): AircraftOperator[] {
  try {
    return JSON.parse(operatorsInRegion) as AircraftOperator[];
  } catch {
    return [];
  }
}

/**
 * Resolves what to actually show for an aircraft platform when viewed in a
 * given country's context (e.g. linked from that country's airbase page).
 *
 * Once an operator has been `researched`, it is authoritative for that
 * country's view: its own description always applies, and its imageUrl is
 * shown as-is — including when that's `null`, meaning no genuine photo of
 * that country's own aircraft could be verified. In that case we do NOT
 * fall back to the record's generic default image, since that default may
 * itself be a different (possibly wrong) country's aircraft — showing
 * nothing is more honest than showing the wrong photo again.
 *
 * An unresearched operator (or no country given) falls back to the
 * record's generic default for both fields.
 */
export function resolveAircraftView(
  aircraft: { description: string; imageUrl: string | null; operatorsInRegion: string },
  country?: string | null
): { imageUrl: string | null; description: string; operator: AircraftOperator | null } {
  const operators = parseOperators(aircraft.operatorsInRegion);
  const operator = country ? (operators.find((o) => o.country === country) ?? null) : null;
  if (operator?.researched) {
    return {
      imageUrl: operator.imageUrl ?? null,
      description: operator.description ?? aircraft.description,
      operator,
    };
  }
  return {
    imageUrl: aircraft.imageUrl,
    description: aircraft.description,
    operator,
  };
}
