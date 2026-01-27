-- Epic 5: Alerts, Notifications, Analytics Completeness
-- Adds new fields to Alert, new models: DeviceToken, NotificationPreference, NotificationLog

-- 1. Add new columns to Alert
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "firedAt" TIMESTAMP(3);
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT;

-- Backfill unsubscribeToken for existing alerts
UPDATE "Alert" SET "unsubscribeToken" = gen_random_uuid()::text WHERE "unsubscribeToken" IS NULL;

-- Deduplicate Alert rows before adding unique constraint
-- Keep the most recently created alert for each (profileId, titleId, alertType, region) tuple
DELETE FROM "Alert"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("profileId", "titleId", "alertType", "region") "id"
  FROM "Alert"
  ORDER BY "profileId", "titleId", "alertType", "region", "createdAt" DESC, "id" DESC
);

-- Add unique constraint and index on Alert
CREATE UNIQUE INDEX IF NOT EXISTS "Alert_profileId_titleId_alertType_region_key" ON "Alert"("profileId", "titleId", "alertType", "region");
CREATE INDEX IF NOT EXISTS "Alert_status_idx" ON "Alert"("status");

-- 2. Create DeviceToken table
CREATE TABLE IF NOT EXISTS "DeviceToken" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceToken_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_profileId_token_key" ON "DeviceToken"("profileId", "token");
CREATE INDEX IF NOT EXISTS "DeviceToken_profileId_idx" ON "DeviceToken"("profileId");

-- 3. Create NotificationPreference table
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "frequencyCap" INTEGER NOT NULL DEFAULT 10,
  "consentGiven" BOOLEAN NOT NULL DEFAULT false,
  "consentTs" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_profileId_key" ON "NotificationPreference"("profileId");

-- 4. Create NotificationLog table
CREATE TABLE IF NOT EXISTS "NotificationLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "alertId" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationLog_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "NotificationLog_alertId_idx" ON "NotificationLog"("alertId");
CREATE INDEX IF NOT EXISTS "NotificationLog_profileId_idx" ON "NotificationLog"("profileId");
CREATE INDEX IF NOT EXISTS "NotificationLog_sentAt_idx" ON "NotificationLog"("sentAt");
