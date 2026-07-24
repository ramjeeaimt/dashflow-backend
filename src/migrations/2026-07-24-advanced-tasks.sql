-- Advanced task board: additive schema for the extended Task plus its
-- comment / activity / time-log sidecar tables. Idempotent and non-destructive
-- (only ADD ... IF NOT EXISTS / CREATE TABLE IF NOT EXISTS). Safe to re-run.

-- 1. New columns on the existing task table -------------------------------
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "startDate" date;
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "progress" integer NOT NULL DEFAULT 0;
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "order" integer NOT NULL DEFAULT 0;
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "tags" text;
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "estimatedHours" numeric(6,2);
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "parentTaskId" character varying;
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "completedAt" timestamp;
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "createdById" character varying;
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "createdByName" character varying;

-- 2. Comments -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "task_comments" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "taskId" character varying NOT NULL,
  "authorId" character varying,
  "authorName" character varying,
  "authorAvatar" character varying,
  "content" text NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_task_comments" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_task_comments_taskId" ON "task_comments" ("taskId");

-- 3. Activity log ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "task_activities" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "taskId" character varying NOT NULL,
  "type" character varying NOT NULL,
  "actorId" character varying,
  "actorName" character varying,
  "message" text,
  "field" character varying,
  "fromValue" text,
  "toValue" text,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_task_activities" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_task_activities_taskId" ON "task_activities" ("taskId");

-- 4. Time logs ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "task_time_logs" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "taskId" character varying NOT NULL,
  "userId" character varying,
  "userName" character varying,
  "hours" numeric(6,2) NOT NULL,
  "note" character varying,
  "workDate" date,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_task_time_logs" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_task_time_logs_taskId" ON "task_time_logs" ("taskId");
