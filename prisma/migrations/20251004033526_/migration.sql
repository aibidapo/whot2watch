/*
  Warnings:

  - You are about to drop the `TrendingSignal` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TrendingSignal" DROP CONSTRAINT "TrendingSignal_titleId_fkey";

-- DropTable
DROP TABLE "TrendingSignal";
