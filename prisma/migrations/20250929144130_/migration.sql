/*
  Warnings:

  - A unique constraint covering the columns `[imdbId]` on the table `Title` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Title" ADD COLUMN     "imdbId" TEXT;

-- CreateTable
CREATE TABLE "ExternalRating" (
    "id" UUID NOT NULL,
    "titleId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "valueText" TEXT NOT NULL,
    "valueNum" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalRating_titleId_idx" ON "ExternalRating"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRating_titleId_source_key" ON "ExternalRating"("titleId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "Title_imdbId_key" ON "Title"("imdbId");

-- AddForeignKey
ALTER TABLE "ExternalRating" ADD CONSTRAINT "ExternalRating_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
