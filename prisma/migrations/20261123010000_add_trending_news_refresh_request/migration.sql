-- CreateTable
CREATE TABLE IF NOT EXISTS "TrendingNewsRefreshRequest" (
    "id" TEXT NOT NULL,
    "status" "GenerationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "TrendingNewsRefreshRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrendingNewsRefreshRequest_status_idx" ON "TrendingNewsRefreshRequest"("status");
