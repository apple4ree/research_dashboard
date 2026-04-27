-- AlterTable: TodoItem gains Flow J fields
ALTER TABLE "TodoItem" ADD COLUMN "goal" TEXT;
ALTER TABLE "TodoItem" ADD COLUMN "subtasks" TEXT;
ALTER TABLE "TodoItem" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'in_progress';
ALTER TABLE "TodoItem" ADD COLUMN "group" TEXT;

-- CreateTable: FlowEvent
CREATE TABLE "FlowEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectSlug" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "bullets" TEXT,
    "numbers" TEXT,
    "tags" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FlowEvent_projectSlug_fkey" FOREIGN KEY ("projectSlug") REFERENCES "Project" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: FlowEventComment
CREATE TABLE "FlowEventComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "flowEventId" INTEGER NOT NULL,
    "authorLogin" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlowEventComment_flowEventId_fkey" FOREIGN KEY ("flowEventId") REFERENCES "FlowEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: FlowEventTaskLink
CREATE TABLE "FlowEventTaskLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectSlug" TEXT NOT NULL,
    "flowEventId" INTEGER NOT NULL,
    "todoId" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlowEventTaskLink_flowEventId_fkey" FOREIGN KEY ("flowEventId") REFERENCES "FlowEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FlowEventTaskLink_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "TodoItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FlowEvent_projectSlug_source_idx" ON "FlowEvent"("projectSlug", "source");
CREATE INDEX "FlowEvent_projectSlug_date_idx" ON "FlowEvent"("projectSlug", "date");
CREATE INDEX "FlowEventComment_flowEventId_createdAt_idx" ON "FlowEventComment"("flowEventId", "createdAt");
CREATE UNIQUE INDEX "FlowEventTaskLink_flowEventId_todoId_key" ON "FlowEventTaskLink"("flowEventId", "todoId");
CREATE INDEX "FlowEventTaskLink_projectSlug_idx" ON "FlowEventTaskLink"("projectSlug");
