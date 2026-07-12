-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "minLevel" INTEGER NOT NULL DEFAULT 0,
    "unitCost" INTEGER,
    "location" TEXT,
    "supplier" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "finishedStockQty" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BomItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "qtyPerUnit" INTEGER NOT NULL,
    CONSTRAINT "BomItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BomItem_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runNo" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyToProduce" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "producedAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionRunLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productionRunId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "qtyPerUnitSnapshot" INTEGER NOT NULL,
    "qtyConsumed" INTEGER NOT NULL,
    CONSTRAINT "ProductionRunLine_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionRunLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "componentId" TEXT,
    "productId" TEXT,
    "type" TEXT NOT NULL,
    "qtyChange" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Component_sku_key" ON "Component"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "BomItem_productId_componentId_key" ON "BomItem"("productId", "componentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRun_runNo_key" ON "ProductionRun"("runNo");

-- CreateIndex
CREATE INDEX "StockMovement_componentId_createdAt_idx" ON "StockMovement"("componentId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");
