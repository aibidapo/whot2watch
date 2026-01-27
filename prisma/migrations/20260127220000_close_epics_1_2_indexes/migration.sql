-- Close Epics 1 & 2: composite unique index, list-item unique, recommendation index
-- Pre-step: deduplicate Availability rows before adding unique constraint

-- Delete duplicate Availability rows, keeping the one with the most recent lastSeenAt
DELETE FROM "Availability"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("titleId", "service", "region", "offerType") "id"
  FROM "Availability"
  ORDER BY "titleId", "service", "region", "offerType", "lastSeenAt" DESC NULLS LAST, "id" DESC
);

-- Delete duplicate ListItem rows, keeping the one with the earliest addedAt
DELETE FROM "ListItem"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("listId", "titleId") "id"
  FROM "ListItem"
  ORDER BY "listId", "titleId", "addedAt" ASC, "id" ASC
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Availability_titleId_service_region_offerType_key" ON "Availability"("titleId", "service", "region", "offerType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ListItem_listId_titleId_key" ON "ListItem"("listId", "titleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Recommendation_profileId_score_idx" ON "Recommendation"("profileId", "score");
