-- Add payer tracking for Split Bills.
ALTER TABLE "SplitBill" ADD COLUMN "payerParticipantId" TEXT;
ALTER TABLE "SplitBill" ADD COLUMN "paymentDate" TIMESTAMP(3);

CREATE INDEX "SplitBill_payerParticipantId_idx" ON "SplitBill"("payerParticipantId");

ALTER TABLE "SplitBill"
ADD CONSTRAINT "SplitBill_payerParticipantId_fkey"
FOREIGN KEY ("payerParticipantId") REFERENCES "SplitBillParticipant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
