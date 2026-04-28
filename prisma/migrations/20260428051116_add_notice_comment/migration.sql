-- CreateTable
CREATE TABLE "NoticeComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noticeId" TEXT NOT NULL,
    "authorLogin" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoticeComment_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NoticeComment_authorLogin_fkey" FOREIGN KEY ("authorLogin") REFERENCES "Member" ("login") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NoticeComment_noticeId_createdAt_idx" ON "NoticeComment"("noticeId", "createdAt");
