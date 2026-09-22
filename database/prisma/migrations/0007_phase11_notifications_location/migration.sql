-- Phase 11: address defaults/geocoding metadata and durable notifications.
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'SENDING';

ALTER TABLE "Address"
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "validationStatus" VARCHAR(30) NOT NULL DEFAULT 'VERIFIED',
  ADD COLUMN "geocodedAt" TIMESTAMPTZ(3),
  ADD COLUMN "geocodingProvider" VARCHAR(80);

CREATE UNIQUE INDEX "Address_customer_default_key"
  ON "Address" ("customerId") WHERE "isDefault" = true AND "archivedAt" IS NULL;
CREATE INDEX "Address_customer_active_default_idx"
  ON "Address" ("customerId", "archivedAt", "isDefault");

ALTER TABLE "Notification"
  ADD COLUMN "category" VARCHAR(40) NOT NULL DEFAULT 'TRANSACTIONAL',
  ADD COLUMN "referenceType" VARCHAR(60),
  ADD COLUMN "referenceId" VARCHAR(160),
  ADD COLUMN "eventKey" VARCHAR(200),
  ADD COLUMN "deliveredAt" TIMESTAMPTZ(3);
CREATE INDEX "Notification_reference_createdAt_idx"
  ON "Notification" ("referenceType", "referenceId", "createdAt");
CREATE UNIQUE INDEX "Notification_user_eventKey_key"
  ON "Notification" ("userId", "eventKey") WHERE "eventKey" IS NOT NULL;

ALTER TABLE "NotificationDelivery"
  ADD COLUMN "deviceTokenId" UUID,
  ADD COLUMN "sentAt" TIMESTAMPTZ(3),
  ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastError" TEXT;
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_createdAt_idx"
  ON "NotificationDelivery" ("status", "nextAttemptAt", "createdAt");
CREATE INDEX "NotificationDelivery_deviceTokenId_status_idx"
  ON "NotificationDelivery" ("deviceTokenId", "status");
ALTER TABLE "NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_deviceTokenId_fkey"
  FOREIGN KEY ("deviceTokenId") REFERENCES "DeviceToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeviceToken"
  ADD COLUMN "invalidatedAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "NotificationDeliveryAttempt" (
  "id" UUID NOT NULL,
  "deliveryId" UUID NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "DeliveryStatus" NOT NULL,
  "providerReference" VARCHAR(200),
  "error" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDeliveryAttempt_valid" CHECK ("attemptNumber" > 0)
);
CREATE UNIQUE INDEX "NotificationDeliveryAttempt_deliveryId_attemptNumber_key"
  ON "NotificationDeliveryAttempt" ("deliveryId", "attemptNumber");
CREATE INDEX "NotificationDeliveryAttempt_deliveryId_createdAt_idx"
  ON "NotificationDeliveryAttempt" ("deliveryId", "createdAt");
ALTER TABLE "NotificationDeliveryAttempt"
  ADD CONSTRAINT "NotificationDeliveryAttempt_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "NotificationDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical records are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "NotificationDeliveryAttempt_append_only"
  BEFORE UPDATE OR DELETE ON "NotificationDeliveryAttempt"
  FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
