-- CreateEnum
CREATE TYPE "TrendingCategory" AS ENUM ('AIRSTRIKE', 'UAV_DRONE', 'AIR_DEFENSE', 'AIRCRAFT_LOSS', 'NON_KINETIC', 'OTHER');

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrendingIncident" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "category" "TrendingCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "originalLanguage" TEXT,
    "publishedAt" TIMESTAMP(3),
    "status" "ArticleStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdBy" TEXT NOT NULL DEFAULT 'bot',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendingIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrendingIncident_status_idx" ON "TrendingIncident"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrendingIncident_country_idx" ON "TrendingIncident"("country");

-- Guarantee at most one PUBLISHED incident per country (the app also
-- enforces this in lib/trendingNewsRun.ts; this is a belt-and-braces DB
-- constraint against any future bug/race), matching the single-published
-- pattern used for AircraftRecognition (there scoped globally; here scoped
-- per-country via the indexed column instead of a constant).
CREATE UNIQUE INDEX IF NOT EXISTS "TrendingIncident_single_published_per_country_idx" ON "TrendingIncident"("country") WHERE "status" = 'PUBLISHED';
