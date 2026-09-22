ALTER TABLE "Session" ADD COLUMN "familyId" UUID NOT NULL DEFAULT gen_random_uuid();
CREATE INDEX "Session_familyId_idx" ON "Session" ("familyId");
