CREATE TABLE "planning_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"issue_id" text NOT NULL,
	"identifier" text NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_key" text NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"issue_id" text NOT NULL,
	"identifier" text NOT NULL,
	"before_cycle_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"lock_token" uuid,
	"locked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "planning_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"cycle_id" text NOT NULL,
	"cycle_name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planning_items" ADD CONSTRAINT "planning_items_stage_id_planning_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."planning_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_transfer_items" ADD CONSTRAINT "planning_transfer_items_transfer_id_planning_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."planning_transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_transfers" ADD CONSTRAINT "planning_transfers_stage_id_planning_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."planning_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "planning_item_membership" ON "planning_items" USING btree ("stage_id","issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_transfer_issue" ON "planning_transfer_items" USING btree ("transfer_id","issue_id");