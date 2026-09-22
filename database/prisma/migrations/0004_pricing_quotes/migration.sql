-- Durable quotes are separate from the existing immutable per-booking price snapshot.
CREATE TABLE "PricingQuote" (
  "id" UUID NOT NULL, "customerId" UUID NOT NULL, "promotionId" UUID,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PricingQuote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PricingQuote_valid" CHECK ("expiresAt" > "createdAt" AND jsonb_typeof("snapshot") = 'object'),
  CONSTRAINT "PricingQuote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PricingQuote_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PricingQuote_id_customerId_key" ON "PricingQuote"("id", "customerId");
CREATE INDEX "PricingQuote_customerId_createdAt_idx" ON "PricingQuote"("customerId", "createdAt");
CREATE INDEX "PricingQuote_expiresAt_idx" ON "PricingQuote"("expiresAt");
CREATE TABLE "QuoteConsumption" (
  "quoteId" UUID NOT NULL, "bookingId" UUID NOT NULL, "customerId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteConsumption_pkey" PRIMARY KEY ("quoteId"),
  CONSTRAINT "QuoteConsumption_quoteId_customerId_fkey" FOREIGN KEY ("quoteId", "customerId") REFERENCES "PricingQuote"("id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuoteConsumption_bookingId_customerId_fkey" FOREIGN KEY ("bookingId", "customerId") REFERENCES "Booking"("id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "QuoteConsumption_bookingId_key" ON "QuoteConsumption"("bookingId");
CREATE UNIQUE INDEX "QuoteConsumption_quoteId_customerId_key" ON "QuoteConsumption"("quoteId", "customerId");
CREATE UNIQUE INDEX "QuoteConsumption_bookingId_customerId_key" ON "QuoteConsumption"("bookingId", "customerId");
CREATE TRIGGER "PricingQuote_immutable" BEFORE UPDATE OR DELETE ON "PricingQuote" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER "QuoteConsumption_immutable" BEFORE UPDATE OR DELETE ON "QuoteConsumption" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();

-- Published definitions/terms are historical. Only activation and promotion usage may change.
CREATE FUNCTION protect_pricing_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Pricing terms cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF (TG_TABLE_NAME = 'PricingRule' AND (to_jsonb(NEW) - 'active') IS DISTINCT FROM (to_jsonb(OLD) - 'active'))
    OR (TG_TABLE_NAME = 'Promotion' AND (to_jsonb(NEW) - 'active' - 'uses') IS DISTINCT FROM (to_jsonb(OLD) - 'active' - 'uses')) THEN
    RAISE EXCEPTION 'Publish new pricing terms instead of rewriting history' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "PricingRule_protect_terms" BEFORE UPDATE OR DELETE ON "PricingRule" FOR EACH ROW EXECUTE FUNCTION protect_pricing_terms();
CREATE TRIGGER "Promotion_protect_terms" BEFORE UPDATE OR DELETE ON "Promotion" FOR EACH ROW EXECUTE FUNCTION protect_pricing_terms();
