-- AlterTable
ALTER TABLE "Title" ADD COLUMN "traktId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Title_traktId_key" ON "Title"("traktId");
