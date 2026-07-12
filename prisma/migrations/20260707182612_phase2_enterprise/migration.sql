-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "componentId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StockLevel_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "terms" TEXT,
    "leadTimeDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PurchaseRequisition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "warehouseId" TEXT NOT NULL,
    "supplierId" TEXT,
    "note" TEXT,
    "raisedById" TEXT,
    "raisedByName" TEXT,
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" DATETIME,
    "decisionComment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseRequisition_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseRequisition_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseRequisitionLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requisitionId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "qtyRequested" INTEGER NOT NULL,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,
    "estUnitCost" INTEGER,
    CONSTRAINT "PurchaseRequisitionLine_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "PurchaseRequisition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseRequisitionLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "companyName" TEXT NOT NULL DEFAULT 'Assembly Line Inventory',
    "currency" TEXT NOT NULL DEFAULT '₹',
    "managerApprovalLimit" INTEGER NOT NULL DEFAULT 100000000,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "lowStockAlerts" BOOLEAN NOT NULL DEFAULT true
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Component" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "minLevel" INTEGER NOT NULL DEFAULT 0,
    "unitCost" INTEGER,
    "location" TEXT,
    "supplier" TEXT,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Component" ("createdAt", "id", "location", "minLevel", "name", "sku", "stockQty", "supplier", "unit", "unitCost", "updatedAt") SELECT "createdAt", "id", "location", "minLevel", "name", "sku", "stockQty", "supplier", "unit", "unitCost", "updatedAt" FROM "Component";
DROP TABLE "Component";
ALTER TABLE "new_Component" RENAME TO "Component";
CREATE UNIQUE INDEX "Component_sku_key" ON "Component"("sku");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "finishedStockQty" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("createdAt", "description", "finishedStockQty", "id", "name", "sku", "unit", "updatedAt") SELECT "createdAt", "description", "finishedStockQty", "id", "name", "sku", "unit", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE TABLE "new_ProductionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runNo" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "qtyToProduce" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "producedAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionRun_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductionRun" ("createdAt", "createdBy", "id", "note", "producedAt", "productId", "qtyToProduce", "runNo", "status", "updatedAt") SELECT "createdAt", "createdBy", "id", "note", "producedAt", "productId", "qtyToProduce", "runNo", "status", "updatedAt" FROM "ProductionRun";
DROP TABLE "ProductionRun";
ALTER TABLE "new_ProductionRun" RENAME TO "ProductionRun";
CREATE UNIQUE INDEX "ProductionRun_runNo_key" ON "ProductionRun"("runNo");
CREATE TABLE "new_StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "componentId" TEXT,
    "productId" TEXT,
    "warehouseId" TEXT,
    "type" TEXT NOT NULL,
    "qtyChange" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StockMovement" ("balanceAfter", "componentId", "createdAt", "createdBy", "id", "productId", "qtyChange", "reason", "refId", "refType", "type") SELECT "balanceAfter", "componentId", "createdAt", "createdBy", "id", "productId", "qtyChange", "reason", "refId", "refType", "type" FROM "StockMovement";
DROP TABLE "StockMovement";
ALTER TABLE "new_StockMovement" RENAME TO "StockMovement";
CREATE INDEX "StockMovement_componentId_createdAt_idx" ON "StockMovement"("componentId", "createdAt");
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");
CREATE INDEX "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_componentId_warehouseId_key" ON "StockLevel"("componentId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisition_prNo_key" ON "PurchaseRequisition"("prNo");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
