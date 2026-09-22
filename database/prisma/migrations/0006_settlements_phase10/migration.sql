-- Phase 10: explicit settlement lifecycle, immutable payment allocations and reconciliation evidence.
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'CALCULATED';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_REVIEW';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'RECONCILED';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'REVERSED';

ALTER TABLE "ProviderPayable"
  ADD COLUMN "grossAmount" DECIMAL(12,2),
  ADD COLUMN "refundedAmount" DECIMAL(12,2),
  ADD COLUMN "netCustomerAmount" DECIMAL(12,2),
  ADD COLUMN "onlineCollected" DECIMAL(12,2),
  ADD COLUMN "calculationSnapshot" JSONB,
  ADD COLUMN "calculatedAt" TIMESTAMPTZ(3);

CREATE TABLE "SettlementPaymentAllocation" (
    "id" UUID NOT NULL,
    "settlementId" UUID NOT NULL,
    "settlementItemId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "refundedAmount" DECIMAL(12,2) NOT NULL,
    "allocatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementPaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementReconciliation" (
    "id" UUID NOT NULL,
    "settlementId" UUID NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "expectedCustomerTotal" DECIMAL(12,2) NOT NULL,
    "allocatedPaymentTotal" DECIMAL(12,2) NOT NULL,
    "refundTotal" DECIMAL(12,2) NOT NULL,
    "payoutTotal" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "details" JSONB NOT NULL,
    "reconciledByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementReconciliation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProviderPayable"
  ADD CONSTRAINT "ProviderPayable_phase10_amounts_valid"
  CHECK ("grossAmount" IS NULL OR ("grossAmount" >= 0 AND "refundedAmount" >= 0 AND "netCustomerAmount" >= 0 AND "onlineCollected" >= 0));
ALTER TABLE "SettlementPaymentAllocation"
  ADD CONSTRAINT "SettlementPaymentAllocation_amounts_valid"
  CHECK ("amount" >= 0 AND "refundedAmount" >= 0);
ALTER TABLE "SettlementReconciliation"
  ADD CONSTRAINT "SettlementReconciliation_status_valid"
  CHECK ("status" IN ('MATCHED', 'DISCREPANCY'));

CREATE UNIQUE INDEX "SettlementPaymentAllocation_paymentId_key" ON "SettlementPaymentAllocation"("paymentId");
CREATE UNIQUE INDEX "SettlementPaymentAllocation_settlementItemId_paymentId_key" ON "SettlementPaymentAllocation"("settlementItemId", "paymentId");
CREATE INDEX "SettlementPaymentAllocation_settlementId_idx" ON "SettlementPaymentAllocation"("settlementId");
CREATE UNIQUE INDEX "SettlementReconciliation_settlementId_runNumber_key" ON "SettlementReconciliation"("settlementId", "runNumber");
CREATE INDEX "SettlementReconciliation_settlementId_createdAt_idx" ON "SettlementReconciliation"("settlementId", "createdAt");

ALTER TABLE "SettlementPaymentAllocation" ADD CONSTRAINT "SettlementPaymentAllocation_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementPaymentAllocation" ADD CONSTRAINT "SettlementPaymentAllocation_settlementItemId_fkey" FOREIGN KEY ("settlementItemId") REFERENCES "SettlementItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementPaymentAllocation" ADD CONSTRAINT "SettlementPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementReconciliation" ADD CONSTRAINT "SettlementReconciliation_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementReconciliation" ADD CONSTRAINT "SettlementReconciliation_reconciledByUserId_fkey" FOREIGN KEY ("reconciledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "SettlementPaymentAllocation_append_only" BEFORE UPDATE OR DELETE ON "SettlementPaymentAllocation" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER "SettlementReconciliation_append_only" BEFORE UPDATE OR DELETE ON "SettlementReconciliation" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
