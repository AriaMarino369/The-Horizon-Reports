-- AlterTable
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "blueprintImageUrl" TEXT;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "blueprintLicense" TEXT;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "blueprintSourceName" TEXT;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "blueprintSourceUrl" TEXT;
