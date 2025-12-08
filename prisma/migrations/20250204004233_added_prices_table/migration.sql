-- CreateTable
CREATE TABLE "Price" (
    "id" SERIAL NOT NULL,
    "time" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Price_time_key" ON "Price"("time");
