ALTER TABLE "linear_workspaces" ADD COLUMN "logo_url" text;
--> statement-breakpoint
UPDATE "linear_workspaces"
SET "logo_url" = 'https://uploads.linear.app/303b0da7-728c-489a-baae-f377a317d8cc/45a2f496-7741-4b4a-9679-2154638ea439/256x256/fe587041-8d18-4260-b882-c0ddfcb2417b'
WHERE "slug" = 'movosend';
