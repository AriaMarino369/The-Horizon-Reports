-- AlterTable
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "development" TEXT;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "operationalHistory" TEXT;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "recentEventTitle" TEXT;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "recentEventUrl" TEXT;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "recentEventSourceName" TEXT;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "recentEventSummary" TEXT;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "recentEventPublishedAt" TIMESTAMP(3);
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "recentEventRefreshedAt" TIMESTAMP(3);
