-- PostgreSQL rules not expressible in Prisma's schema language.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE UNIQUE INDEX "UserRole_scope_unique" ON "UserRole" ("userId", "roleId", "companyId", "teamId") NULLS NOT DISTINCT;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_team_company" FOREIGN KEY ("teamId", "companyId") REFERENCES "Team" ("id", "companyId") ON DELETE RESTRICT;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_team_requires_company" CHECK ("teamId" IS NULL OR "companyId" IS NOT NULL);

CREATE UNIQUE INDEX "Assignment_one_active_per_booking" ON "Assignment" ("bookingId") WHERE "status" IN ('OFFERED', 'ACCEPTED');
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_no_team_overlap" EXCLUDE USING gist (
  "teamId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&
) WHERE ("status" IN ('OFFERED', 'ACCEPTED'));
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_valid_interval" CHECK ("endsAt" > "startsAt" AND "expiresAt" > "assignedAt");
ALTER TABLE "TeamAvailability" ADD CONSTRAINT "TeamAvailability_valid_interval" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_valid_values" CHECK ("price" >= 0 AND "currency" = 'JOD' AND "version" >= 0 AND "estimatedEndAt" > "scheduledAt" AND "locationLatitude" BETWEEN -90 AND 90 AND "locationLongitude" BETWEEN -180 AND 180);
ALTER TABLE "Company" ADD CONSTRAINT "Company_commission_range" CHECK ("commissionRate" BETWEEN 0 AND 1);
ALTER TABLE "Team" ADD CONSTRAINT "Team_valid_values" CHECK ("capacity" > 0 AND ("latitude" IS NULL) = ("longitude" IS NULL) AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180);
ALTER TABLE "Address" ADD CONSTRAINT "Address_coordinate_range" CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180);
ALTER TABLE "CompanyServiceArea" ADD CONSTRAINT "CompanyServiceArea_valid_values" CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180 AND "radiusKm" > 0);
ALTER TABLE "Property" ADD CONSTRAINT "Property_valid_values" CHECK ("size" > 0 AND "rooms" >= 0 AND "bathrooms" >= 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_valid_values" CHECK ("basePrice" >= 0 AND "durationMinutes" > 0);
ALTER TABLE "ServiceExtra" ADD CONSTRAINT "ServiceExtra_nonnegative_price" CHECK ("price" >= 0);
ALTER TABLE "BookingExtra" ADD CONSTRAINT "BookingExtra_valid_values" CHECK ("price" >= 0 AND "quantity" > 0);
ALTER TABLE "BookingPriceSnapshot" ADD CONSTRAINT "BookingPriceSnapshot_balanced" CHECK (
  "basePrice" >= 0 AND "extrasTotal" >= 0 AND "fees" >= 0 AND "discount" >= 0 AND "total" >= 0 AND "currency" = 'JOD'
  AND "total" = "basePrice" + "extrasTotal" + "adjustments" + "fees" - "discount"
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_valid_values" CHECK ("amount" >= 0 AND "currency" = 'JOD');
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_nonnegative" CHECK ("amount" >= 0);
ALTER TABLE "CashCollection" ADD CONSTRAINT "CashCollection_nonnegative" CHECK ("amount" >= 0);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_positive" CHECK ("amount" > 0);
ALTER TABLE "ProviderPayable" ADD CONSTRAINT "ProviderPayable_balanced" CHECK (
  "customerAmount" >= 0 AND "platformCommission" >= 0 AND "providerAmount" >= 0 AND "cashCollected" >= 0
  AND "commissionRate" BETWEEN 0 AND 1
  AND "customerAmount" = "platformCommission" + "providerAmount"
  AND "netPayable" = "providerAmount" - "cashCollected"
);
-- Settlement totals/net payables are intentionally signed: cash can be owed to Home Clean.
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_valid_values" CHECK ("periodEnd" > "periodStart" AND "currency" = 'JOD');
ALTER TABLE "SettlementPayment" ADD CONSTRAINT "SettlementPayment_valid_values" CHECK ("amount" > 0 AND "direction" IN ('TO_PROVIDER', 'TO_PLATFORM'));
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_score_range" CHECK ("score" BETWEEN 1 AND 5);
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_valid_values" CHECK ("discount" >= 0 AND "minTotal" >= 0 AND "uses" >= 0 AND ("maxUses" IS NULL OR ("maxUses" > 0 AND "uses" <= "maxUses")) AND "endsAt" > "startsAt");
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_valid_values" CHECK ("version" > 0 AND ("endsAt" IS NULL OR "endsAt" > "startsAt"));
ALTER TABLE "CompletionProof" ADD CONSTRAINT "CompletionProof_size" CHECK ("byteSize" > 0);
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_attempts" CHECK ("attempts" >= 0 AND "expiresAt" > "createdAt");
ALTER TABLE "Session" ADD CONSTRAINT "Session_expiry" CHECK ("accessExpiresAt" <= "expiresAt" AND "expiresAt" > "createdAt");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_booking_owner" FOREIGN KEY ("bookingId", "customerId") REFERENCES "Booking" ("id", "customerId") ON DELETE RESTRICT;

CREATE FUNCTION prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical records are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "AuditLog_append_only" BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER "BookingStatusHistory_append_only" BEFORE UPDATE OR DELETE ON "BookingStatusHistory" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER "BookingPriceSnapshot_immutable" BEFORE UPDATE OR DELETE ON "BookingPriceSnapshot" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER "PaymentTransaction_append_only" BEFORE UPDATE OR DELETE ON "PaymentTransaction" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER "PaymentEvent_append_only" BEFORE UPDATE OR DELETE ON "PaymentEvent" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();

CREATE FUNCTION protect_booking_snapshots() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."addressSnapshot" IS DISTINCT FROM OLD."addressSnapshot"
    OR NEW."propertySnapshot" IS DISTINCT FROM OLD."propertySnapshot"
    OR NEW."serviceSnapshot" IS DISTINCT FROM OLD."serviceSnapshot"
    OR NEW."locationLatitude" IS DISTINCT FROM OLD."locationLatitude"
    OR NEW."locationLongitude" IS DISTINCT FROM OLD."locationLongitude" THEN
    RAISE EXCEPTION 'Booking snapshots are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Booking_protect_snapshots" BEFORE UPDATE ON "Booking" FOR EACH ROW EXECUTE FUNCTION protect_booking_snapshots();
