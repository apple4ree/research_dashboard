-- CreateTable
CREATE TABLE "WikiEntityStar" (
    "memberLogin" TEXT NOT NULL,
    "projectSlug" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("memberLogin", "projectSlug", "entityId"),
    CONSTRAINT "WikiEntityStar_memberLogin_fkey" FOREIGN KEY ("memberLogin") REFERENCES "Member" ("login") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WikiEntityStar_projectSlug_entityId_fkey" FOREIGN KEY ("projectSlug", "entityId") REFERENCES "WikiEntity" ("projectSlug", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WikiEntityStar_memberLogin_createdAt_idx" ON "WikiEntityStar"("memberLogin", "createdAt");

-- CreateIndex
CREATE INDEX "WikiEntityStar_projectSlug_entityId_idx" ON "WikiEntityStar"("projectSlug", "entityId");
