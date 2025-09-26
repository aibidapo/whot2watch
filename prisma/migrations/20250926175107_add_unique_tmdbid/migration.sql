/*
  Warnings:

  - A unique constraint covering the columns `[tmdbId]` on the table `Title` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Title_tmdbId_key" ON "Title"("tmdbId");
