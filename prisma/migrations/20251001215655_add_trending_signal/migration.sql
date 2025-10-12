-- CreateTable
CREATE TABLE "TrendingSignal" (
    "id" UUID NOT NULL,
    "titleId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendingSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrendingSignal_titleId_idx" ON "TrendingSignal"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "TrendingSignal_titleId_source_key" ON "TrendingSignal"("titleId", "source");

-- AddForeignKey
ALTER TABLE "TrendingSignal" ADD CONSTRAINT "TrendingSignal_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
