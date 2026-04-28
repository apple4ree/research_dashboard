-- CreateTable
CREATE TABLE "WikiEntityAttachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectSlug" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WikiEntityAttachment_projectSlug_entityId_fkey" FOREIGN KEY ("projectSlug", "entityId") REFERENCES "WikiEntity" ("projectSlug", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FlowEventAttachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "flowEventId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlowEventAttachment_flowEventId_fkey" FOREIGN KEY ("flowEventId") REFERENCES "FlowEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WikiEntityAttachment_projectSlug_entityId_position_idx" ON "WikiEntityAttachment"("projectSlug", "entityId", "position");

-- CreateIndex
CREATE INDEX "FlowEventAttachment_flowEventId_position_idx" ON "FlowEventAttachment"("flowEventId", "position");
