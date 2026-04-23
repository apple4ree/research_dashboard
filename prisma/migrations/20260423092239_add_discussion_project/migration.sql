-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Discussion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorLogin" TEXT NOT NULL,
    "projectSlug" TEXT,
    "createdAt" DATETIME NOT NULL,
    "lastActivityAt" DATETIME NOT NULL,
    "replyCount" INTEGER NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "externalId" TEXT,
    "lastSyncedAt" DATETIME,
    CONSTRAINT "Discussion_authorLogin_fkey" FOREIGN KEY ("authorLogin") REFERENCES "Member" ("login") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Discussion_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Discussion" ("authorLogin", "bodyMarkdown", "category", "createdAt", "externalId", "id", "lastActivityAt", "lastSyncedAt", "replyCount", "source", "title") SELECT "authorLogin", "bodyMarkdown", "category", "createdAt", "externalId", "id", "lastActivityAt", "lastSyncedAt", "replyCount", "source", "title" FROM "Discussion";
DROP TABLE "Discussion";
ALTER TABLE "new_Discussion" RENAME TO "Discussion";
CREATE UNIQUE INDEX "Discussion_externalId_key" ON "Discussion"("externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
