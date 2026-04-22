-- CreateTable
CREATE TABLE "Member" (
    "login" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "pinnedProjectSlugs" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "externalId" TEXT,
    "lastSyncedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Project" (
    "slug" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "externalId" TEXT,
    "lastSyncedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectSlug" TEXT NOT NULL,
    "memberLogin" TEXT NOT NULL,

    PRIMARY KEY ("projectSlug", "memberLogin"),
    CONSTRAINT "ProjectMember_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_memberLogin_fkey" FOREIGN KEY ("memberLogin") REFERENCES "Member" ("login") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectRepo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectSlug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "ProjectRepo_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "projectSlug" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "venue" TEXT,
    "deadline" DATETIME,
    "draftUrl" TEXT,
    "pdfUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "externalId" TEXT,
    "lastSyncedAt" DATETIME,
    CONSTRAINT "Paper_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperAuthor" (
    "paperId" TEXT NOT NULL,
    "authorLogin" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    PRIMARY KEY ("paperId", "authorLogin"),
    CONSTRAINT "PaperAuthor_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaperAuthor_authorLogin_fkey" FOREIGN KEY ("authorLogin") REFERENCES "Member" ("login") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExperimentRun" (
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
    CONSTRAINT "ExperimentRun_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExperimentRun_triggeredByLogin_fkey" FOREIGN KEY ("triggeredByLogin") REFERENCES "Member" ("login") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Discussion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorLogin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "lastActivityAt" DATETIME NOT NULL,
    "replyCount" INTEGER NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "externalId" TEXT,
    "lastSyncedAt" DATETIME,
    CONSTRAINT "Discussion_authorLogin_fkey" FOREIGN KEY ("authorLogin") REFERENCES "Member" ("login") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discussionId" TEXT NOT NULL,
    "authorLogin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "externalId" TEXT,
    "lastSyncedAt" DATETIME,
    CONSTRAINT "Reply_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reply_authorLogin_fkey" FOREIGN KEY ("authorLogin") REFERENCES "Member" ("login") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "projectSlug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "description" TEXT,
    "downloadUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "externalId" TEXT,
    "lastSyncedAt" DATETIME,
    CONSTRAINT "Release_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "actorLogin" TEXT NOT NULL,
    "projectSlug" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityEvent_actorLogin_fkey" FOREIGN KEY ("actorLogin") REFERENCES "Member" ("login") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "deadline" DATETIME NOT NULL,
    "kind" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_externalId_key" ON "Member"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_externalId_key" ON "Project"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Paper_externalId_key" ON "Paper"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentRun_externalId_key" ON "ExperimentRun"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Discussion_externalId_key" ON "Discussion"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Reply_externalId_key" ON "Reply"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Release_externalId_key" ON "Release"("externalId");
