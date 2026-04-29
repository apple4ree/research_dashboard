-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WikiEntity" (
    "projectSlug" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "summaryMarkdown" TEXT NOT NULL DEFAULT '',
    "bodyMarkdown" TEXT NOT NULL,
    "sourceFiles" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'wiki-llm',

    PRIMARY KEY ("projectSlug", "id"),
    CONSTRAINT "WikiEntity_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WikiEntity" ("bodyMarkdown", "id", "lastSyncedAt", "name", "projectSlug", "source", "sourceFiles", "status", "summaryMarkdown", "type") SELECT "bodyMarkdown", "id", "lastSyncedAt", "name", "projectSlug", "source", "sourceFiles", "status", "summaryMarkdown", "type" FROM "WikiEntity";
DROP TABLE "WikiEntity";
ALTER TABLE "new_WikiEntity" RENAME TO "WikiEntity";
CREATE INDEX "WikiEntity_projectSlug_type_idx" ON "WikiEntity"("projectSlug", "type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
