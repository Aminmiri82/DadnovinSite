/*
  Warnings:

  - You are about to drop the column `allottedTime` on the `Transaction` table. All the data in the column will be lost.
  - Added the required column `validUntil` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "allottedTime",
ADD COLUMN     "validUntil" TIMESTAMP(3) NOT NULL;
