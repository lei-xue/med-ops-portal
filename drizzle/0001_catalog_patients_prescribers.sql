CREATE TYPE "public"."dea_schedule" AS ENUM('II', 'III', 'IV', 'V');--> statement-breakpoint
CREATE TYPE "public"."rx_status" AS ENUM('rx', 'otc');--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"mrn" text NOT NULL,
	"name" text NOT NULL,
	"date_of_birth" date,
	"allergies" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"credentials" text NOT NULL,
	"npi" text NOT NULL,
	"specialty" text NOT NULL,
	"practice" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Added nullable, backfilled from patient_name below, then made NOT NULL.
ALTER TABLE "medication_orders" ADD COLUMN "patient_id" integer;--> statement-breakpoint
ALTER TABLE "medication_orders" ADD COLUMN "prescriber_id" integer;--> statement-breakpoint
ALTER TABLE "medication_orders" ADD COLUMN "directions" text;--> statement-breakpoint
ALTER TABLE "medication_orders" ADD COLUMN "refills" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "medication_orders" ADD COLUMN "days_supply" integer;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "brand_name" text;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "drug_class" text DEFAULT 'Other' NOT NULL;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "route" text DEFAULT 'oral' NOT NULL;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "rx_status" "rx_status" DEFAULT 'rx' NOT NULL;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "dea_schedule" "dea_schedule";--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "stock_unit" text DEFAULT 'units' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "patients_mrn_unique" ON "patients" USING btree ("mrn");--> statement-breakpoint
CREATE INDEX "patients_name_idx" ON "patients" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "prescribers_npi_unique" ON "prescribers" USING btree ("npi");--> statement-breakpoint
ALTER TABLE "medication_orders" ADD CONSTRAINT "medication_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_orders" ADD CONSTRAINT "medication_orders_prescriber_id_prescribers_id_fk" FOREIGN KEY ("prescriber_id") REFERENCES "public"."prescribers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medication_orders_patient_idx" ON "medication_orders" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "medication_orders_prescriber_idx" ON "medication_orders" USING btree ("prescriber_id"); --> statement-breakpoint
-- Data migration: every distinct free-text patient name becomes a patient
-- record (legacy MRNs are prefixed MRN-L), and orders are linked to it.
INSERT INTO "patients" ("mrn", "name")
SELECT 'MRN-L' || lpad((row_number() OVER (ORDER BY first_id))::text, 5, '0'), "patient_name"
FROM (
	SELECT "patient_name", min("id") AS first_id
	FROM "medication_orders"
	GROUP BY "patient_name"
) AS legacy;--> statement-breakpoint
UPDATE "medication_orders" AS o
SET "patient_id" = p."id"
FROM "patients" AS p
WHERE p."name" = o."patient_name" AND p."mrn" LIKE 'MRN-L%';--> statement-breakpoint
ALTER TABLE "medication_orders" ALTER COLUMN "patient_id" SET NOT NULL;--> statement-breakpoint
-- Count stock in the unit the dosage form implies for existing products.
UPDATE "medications" SET "stock_unit" = CASE "dosage_form"
	WHEN 'capsule' THEN 'capsules'
	WHEN 'tablet' THEN 'tablets'
	WHEN 'inhaler' THEN 'inhalers'
	ELSE 'units'
END;--> statement-breakpoint
UPDATE "medications" SET "route" = 'inhalation' WHERE "dosage_form" = 'inhaler';
