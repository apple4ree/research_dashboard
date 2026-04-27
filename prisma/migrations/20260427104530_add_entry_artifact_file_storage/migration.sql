-- AlterTable
ALTER TABLE "EntryArtifact" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "EntryArtifact" ADD COLUMN "originalFilename" TEXT;
ALTER TABLE "EntryArtifact" ADD COLUMN "sizeBytes" INTEGER;
ALTER TABLE "EntryArtifact" ADD COLUMN "storedPath" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FlowEventTaskLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectSlug" TEXT NOT NULL,
    "flowEventId" INTEGER NOT NULL,
    "todoId" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlowEventTaskLink_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FlowEventTaskLink_flowEventId_fkey" FOREIGN KEY ("flowEventId") REFERENCES "FlowEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FlowEventTaskLink_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "TodoItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FlowEventTaskLink" ("createdAt", "flowEventId", "id", "projectSlug", "source", "todoId") SELECT "createdAt", "flowEventId", "id", "projectSlug", "source", "todoId" FROM "FlowEventTaskLink";
DROP TABLE "FlowEventTaskLink";
ALTER TABLE "new_FlowEventTaskLink" RENAME TO "FlowEventTaskLink";
CREATE INDEX "FlowEventTaskLink_projectSlug_idx" ON "FlowEventTaskLink"("projectSlug");
CREATE UNIQUE INDEX "FlowEventTaskLink_flowEventId_todoId_key" ON "FlowEventTaskLink"("flowEventId", "todoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
