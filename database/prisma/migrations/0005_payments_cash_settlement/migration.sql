-- Phase 9: additive payment attempts, financial history, cash attribution and settlement controls.
ALTER TABLE "PaymentEvent"
  ADD COLUMN "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "verifiedAt" TIMESTAMPTZ(3);

ALTER TABLE "CashCollection"
  ADD COLUMN "collectorCompanyId" UUID,
  ADD COLUMN "collectorTeamId" UUID;

ALTER TABLE "Refund"
  ADD COLUMN "provider" VARCHAR(80),
  ADD COLUMN "failureCode" VARCHAR(80);

ALTER TABLE "Settlement"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PaymentAttempt" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "providerReference" VARCHAR(160),
    "checkoutUrl" VARCHAR(1000),
    "requestKey" VARCHAR(128) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "failureCode" VARCHAR(80),
    "failureMessage" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentStatusHistory" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "previousStatus" "PaymentStatus",
    "newStatus" "PaymentStatus" NOT NULL,
    "reason" TEXT,
    "provider" VARCHAR(80),
    "eventId" VARCHAR(160),
    "changedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefundHistory" (
    "id" UUID NOT NULL,
    "refundId" UUID NOT NULL,
    "previousStatus" "RefundStatus",
    "newStatus" "RefundStatus" NOT NULL,
    "provider" VARCHAR(80),
    "reference" VARCHAR(160),
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefundHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementHistory" (
    "id" UUID NOT NULL,
    "settlementId" UUID NOT NULL,
    "previousStatus" "SettlementStatus",
    "newStatus" "SettlementStatus" NOT NULL,
    "reason" TEXT,
    "changedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_nonnegative" CHECK ("amount" >= 0 AND "currency" = 'JOD' AND "attemptNumber" > 0);
ALTER TABLE "PaymentStatusHistory" ADD CONSTRAINT "PaymentStatusHistory_status_valid" CHECK ("newStatus" IS NOT NULL);
ALTER TABLE "RefundHistory" ADD CONSTRAINT "RefundHistory_status_valid" CHECK ("newStatus" IS NOT NULL);
ALTER TABLE "SettlementHistory" ADD CONSTRAINT "SettlementHistory_status_valid" CHECK ("newStatus" IS NOT NULL);

CREATE UNIQUE INDEX "PaymentAttempt_paymentId_attemptNumber_key" ON "PaymentAttempt"("paymentId", "attemptNumber");
CREATE UNIQUE INDEX "PaymentAttempt_paymentId_requestKey_key" ON "PaymentAttempt"("paymentId", "requestKey");
CREATE UNIQUE INDEX "PaymentAttempt_provider_providerReference_key" ON "PaymentAttempt"("provider", "providerReference");
CREATE INDEX "PaymentAttempt_provider_status_createdAt_idx" ON "PaymentAttempt"("provider", "status", "createdAt");
CREATE INDEX "PaymentStatusHistory_paymentId_createdAt_idx" ON "PaymentStatusHistory"("paymentId", "createdAt");
CREATE INDEX "RefundHistory_refundId_createdAt_idx" ON "RefundHistory"("refundId", "createdAt");
CREATE INDEX "SettlementHistory_settlementId_createdAt_idx" ON "SettlementHistory"("settlementId", "createdAt");
CREATE INDEX "CashCollection_collectorCompanyId_collectedAt_idx" ON "CashCollection"("collectorCompanyId", "collectedAt");
CREATE INDEX "CashCollection_collectorTeamId_collectedAt_idx" ON "CashCollection"("collectorTeamId", "collectedAt");

ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentStatusHistory" ADD CONSTRAINT "PaymentStatusHistory_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentStatusHistory" ADD CONSTRAINT "PaymentStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundHistory" ADD CONSTRAINT "RefundHistory_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementHistory" ADD CONSTRAINT "SettlementHistory_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementHistory" ADD CONSTRAINT "SettlementHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashCollection" ADD CONSTRAINT "CashCollection_collectorCompanyId_fkey" FOREIGN KEY ("collectorCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashCollection" ADD CONSTRAINT "CashCollection_collectorTeamId_fkey" FOREIGN KEY ("collectorTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "PaymentStatusHistory_append_only" BEFORE UPDATE OR DELETE ON "PaymentStatusHistory" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER "RefundHistory_append_only" BEFORE UPDATE OR DELETE ON "RefundHistory" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER "SettlementHistory_append_only" BEFORE UPDATE OR DELETE ON "SettlementHistory" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
