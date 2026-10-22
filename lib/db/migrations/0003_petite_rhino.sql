CREATE TABLE "linear_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"target_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linear_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"linear_team_id" text,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linear_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"connection_status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "linear_workspaces_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_email_pk" PRIMARY KEY("workspace_id","email")
);
--> statement-breakpoint
ALTER TABLE "planning_stages" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "sync_log" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "linear_audit" ADD CONSTRAINT "linear_audit_workspace_id_linear_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."linear_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_audit" ADD CONSTRAINT "linear_audit_team_id_linear_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."linear_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_teams" ADD CONSTRAINT "linear_teams_workspace_id_linear_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."linear_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_linear_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."linear_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_stages" ADD CONSTRAINT "planning_stages_team_id_linear_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."linear_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_team_id_linear_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."linear_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_team_id_linear_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."linear_teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "linear_workspaces" ("id", "organization_id", "slug", "name", "connection_status") VALUES ('00000000-0000-4000-8000-000000000001', 'legacy-movosend', 'movosend', 'Movo', 'legacy');
--> statement-breakpoint
INSERT INTO "linear_teams" ("id", "workspace_id", "key", "name", "enabled") VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'MOVO', 'Movo Team', true);
--> statement-breakpoint
INSERT INTO "workspace_members" ("workspace_id", "email", "added_at") SELECT '00000000-0000-4000-8000-000000000001', "email", "added_at" FROM "allowed_users";
--> statement-breakpoint
UPDATE "snapshots" SET "team_id" = '00000000-0000-4000-8000-000000000002' WHERE "team_key" = 'MOVO';
--> statement-breakpoint
UPDATE "planning_stages" SET "team_id" = '00000000-0000-4000-8000-000000000002' WHERE "team_key" = 'MOVO';
