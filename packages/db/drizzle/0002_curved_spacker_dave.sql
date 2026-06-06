CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ok" boolean NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"stats" jsonb,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "ingest_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "ingest_runs_kind_started_idx" ON "ingest_runs" USING btree ("kind","started_at" DESC NULLS LAST);