-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "hypothesis" TEXT NOT NULL DEFAULT '',
    "bodyMarkdown" TEXT NOT NULL DEFAULT '',
    "sourceWikiSlug" TEXT,
    "sourceWikiEntityId" TEXT,
    "createdByLogin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Experiment_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Experiment_createdByLogin_fkey" FOREIGN KEY ("createdByLogin") REFERENCES "Member" ("login") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExperimentResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "metricsJson" TEXT NOT NULL DEFAULT '[]',
    "kind" TEXT NOT NULL DEFAULT 'benchmark',
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExperimentResult_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExperimentResultAttachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "resultId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperimentResultAttachment_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ExperimentResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExperimentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "projectSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "durationSec" INTEGER,
    "triggeredByLogin" TEXT NOT NULL,
    "summary" TEXT,
    "stepsJson" TEXT,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "externalId" TEXT,
    "lastSyncedAt" DATETIME,
    "experimentId" TEXT,
    CONSTRAINT "ExperimentRun_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExperimentRun_triggeredByLogin_fkey" FOREIGN KEY ("triggeredByLogin") REFERENCES "Member" ("login") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExperimentRun_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ExperimentRun" ("durationSec", "externalId", "id", "lastSyncedAt", "name", "projectSlug", "source", "startedAt", "status", "stepsJson", "summary", "triggeredByLogin") SELECT "durationSec", "externalId", "id", "lastSyncedAt", "name", "projectSlug", "source", "startedAt", "status", "stepsJson", "summary", "triggeredByLogin" FROM "ExperimentRun";
DROP TABLE "ExperimentRun";
ALTER TABLE "new_ExperimentRun" RENAME TO "ExperimentRun";
CREATE UNIQUE INDEX "ExperimentRun_externalId_key" ON "ExperimentRun"("externalId");
CREATE INDEX "ExperimentRun_experimentId_idx" ON "ExperimentRun"("experimentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Experiment_projectSlug_status_createdAt_idx" ON "Experiment"("projectSlug", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ExperimentResult_experimentId_publishedAt_idx" ON "ExperimentResult"("experimentId", "publishedAt");

-- CreateIndex
CREATE INDEX "ExperimentResultAttachment_resultId_position_idx" ON "ExperimentResultAttachment"("resultId", "position");
