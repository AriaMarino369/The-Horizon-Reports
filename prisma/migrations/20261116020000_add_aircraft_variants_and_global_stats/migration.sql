-- AlterTable
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "originCountry" TEXT;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "yearIntroduced" INTEGER;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "numberProduced" INTEGER;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "unitPriceUsdMillions" DOUBLE PRECISION;
ALTER TABLE "MilitaryAircraft" ADD COLUMN IF NOT EXISTS "activeWorldwide" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AircraftVariant" (
    "id" TEXT NOT NULL,
    "aircraftId" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "customer" TEXT,
    "builtOrOrdered" TEXT,
    "definingHardware" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AircraftVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AircraftVariant_aircraftId_idx" ON "AircraftVariant"("aircraftId");

-- AddForeignKey
ALTER TABLE "AircraftVariant" ADD CONSTRAINT "AircraftVariant_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "MilitaryAircraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
