-- AlterTable
ALTER TABLE "Project" ADD COLUMN "localPath" TEXT;

-- CreateTable
CREATE TABLE "WikiType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectSlug" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    CONSTRAINT "WikiType_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WikiEntity" (
    "projectSlug" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "summaryMarkdown" TEXT NOT NULL DEFAULT '',
    "bodyMarkdown" TEXT NOT NULL,
    "sourceFiles" TEXT NOT NULL DEFAULT '[]',
    "lastSyncedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'wiki-llm',

    PRIMARY KEY ("projectSlug", "id"),
    CONSTRAINT "WikiEntity_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WikiType_projectSlug_key_key" ON "WikiType"("projectSlug", "key");

-- CreateIndex
CREATE INDEX "WikiEntity_projectSlug_type_idx" ON "WikiEntity"("projectSlug", "type");
