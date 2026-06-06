CREATE TABLE "calc_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "craft_drops" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"result_grade_id" smallint NOT NULL,
	"item_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "craft_recipe_materials" (
	"recipe_id" integer NOT NULL,
	"material_id" integer NOT NULL,
	"qty" smallint NOT NULL,
	CONSTRAINT "craft_recipe_materials_recipe_id_material_id_pk" PRIMARY KEY("recipe_id","material_id")
);
--> statement-breakpoint
CREATE TABLE "craft_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slot" text NOT NULL,
	"tier" smallint NOT NULL,
	"level_min" smallint NOT NULL,
	"level_max" smallint NOT NULL,
	"cube_level" smallint,
	"gold_cost" integer DEFAULT 0,
	"grade_odds" jsonb NOT NULL,
	"possible_item_count" integer,
	"source" text DEFAULT 'taskbarhero.wiki' NOT NULL,
	"game_version" text
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" smallint PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"color_hex" text NOT NULL,
	"alchemy_gold" integer NOT NULL,
	"sockets_d" smallint NOT NULL,
	"sockets_e" smallint NOT NULL,
	"sockets_i" smallint NOT NULL,
	"tradable" boolean DEFAULT false NOT NULL,
	CONSTRAINT "grades_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "item_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	CONSTRAINT "item_types_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer,
	"type_id" integer NOT NULL,
	"level" smallint NOT NULL,
	"grade_id" smallint NOT NULL,
	"name_en" text NOT NULL,
	"name_tr" text,
	"slug" text NOT NULL,
	"market_hash_name" text,
	"tradable" boolean DEFAULT false NOT NULL,
	"image_url" text,
	CONSTRAINT "items_game_id_unique" UNIQUE("game_id"),
	CONSTRAINT "items_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "market_mapping_audit" (
	"market_hash_name" text PRIMARY KEY NOT NULL,
	"matched_ref_type" text,
	"matched_ref_id" integer,
	"status" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_prices" (
	"ref_type" text NOT NULL,
	"ref_id" integer NOT NULL,
	"currency" smallint DEFAULT 1 NOT NULL,
	"lowest_cents" integer,
	"median_cents" integer,
	"volume" integer,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_prices_ref_type_ref_id_currency_pk" PRIMARY KEY("ref_type","ref_id","currency")
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer,
	"name_en" text NOT NULL,
	"name_tr" text,
	"slug" text NOT NULL,
	"grade_id" smallint NOT NULL,
	"category" text NOT NULL,
	"market_hash_name" text,
	"tradable" boolean DEFAULT false NOT NULL,
	"image_url" text,
	CONSTRAINT "materials_game_id_unique" UNIQUE("game_id"),
	CONSTRAINT "materials_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"cost_cents" integer NOT NULL,
	"ev_cents" integer NOT NULL,
	"net_cents" integer NOT NULL,
	"roi" numeric(8, 4) NOT NULL,
	"profit_prob" numeric(6, 4),
	"fail_prob" numeric(6, 4),
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"ref_type" text NOT NULL,
	"ref_id" integer NOT NULL,
	"currency" smallint DEFAULT 1 NOT NULL,
	"price_cents" integer NOT NULL,
	"volume" integer,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "synthesis_drops" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"result_grade_id" smallint NOT NULL,
	"tier" smallint NOT NULL,
	"item_id" integer,
	"material_id" integer
);
--> statement-breakpoint
CREATE TABLE "synthesis_rates" (
	"input_grade_id" smallint NOT NULL,
	"result_grade_id" smallint NOT NULL,
	"probability" numeric(8, 6) NOT NULL,
	"is_fail" boolean DEFAULT false NOT NULL,
	"is_great_success" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'taskbarhero.wiki' NOT NULL,
	"game_version" text,
	CONSTRAINT "synthesis_rates_input_grade_id_result_grade_id_pk" PRIMARY KEY("input_grade_id","result_grade_id")
);
--> statement-breakpoint
CREATE TABLE "synthesis_tiers" (
	"tier" smallint PRIMARY KEY NOT NULL,
	"level_min" smallint NOT NULL,
	"level_max" smallint NOT NULL,
	"cube_level" smallint NOT NULL,
	"gold_cost" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "craft_drops" ADD CONSTRAINT "craft_drops_recipe_id_craft_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."craft_recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_drops" ADD CONSTRAINT "craft_drops_result_grade_id_grades_id_fk" FOREIGN KEY ("result_grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_drops" ADD CONSTRAINT "craft_drops_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_recipe_materials" ADD CONSTRAINT "craft_recipe_materials_recipe_id_craft_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."craft_recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craft_recipe_materials" ADD CONSTRAINT "craft_recipe_materials_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_type_id_item_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_drops" ADD CONSTRAINT "synthesis_drops_result_grade_id_grades_id_fk" FOREIGN KEY ("result_grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_drops" ADD CONSTRAINT "synthesis_drops_tier_synthesis_tiers_tier_fk" FOREIGN KEY ("tier") REFERENCES "public"."synthesis_tiers"("tier") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_drops" ADD CONSTRAINT "synthesis_drops_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_drops" ADD CONSTRAINT "synthesis_drops_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_rates" ADD CONSTRAINT "synthesis_rates_input_grade_id_grades_id_fk" FOREIGN KEY ("input_grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_rates" ADD CONSTRAINT "synthesis_rates_result_grade_id_grades_id_fk" FOREIGN KEY ("result_grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "craft_drops_recipe_grade_idx" ON "craft_drops" USING btree ("recipe_id","result_grade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "craft_recipes_slot_tier_uq" ON "craft_recipes" USING btree ("slot","tier");--> statement-breakpoint
CREATE INDEX "items_grade_level_idx" ON "items" USING btree ("grade_id","level");--> statement-breakpoint
CREATE INDEX "items_type_idx" ON "items" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "opportunities_kind_roi_idx" ON "opportunities" USING btree ("kind","roi" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "price_history_series_idx" ON "price_history" USING btree ("ref_type","ref_id","observed_at");--> statement-breakpoint
CREATE INDEX "synthesis_drops_lookup_idx" ON "synthesis_drops" USING btree ("category","result_grade_id","tier");