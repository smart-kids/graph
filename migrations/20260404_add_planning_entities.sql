-- Migration to add Lesson Plans and IEP Templates

-- Create lesson_plan table
CREATE TABLE IF NOT EXISTS "lesson_plan" (
    "id" TEXT PRIMARY KEY,
    "school" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "term" TEXT,
    "teacher" TEXT,
    "strand" TEXT,
    "substrands" TEXT,
    "learningoutcomes" TEXT,
    "keyenquiringquestions" TEXT,
    "learningresources" TEXT,
    "introduction" TEXT,
    "lessondevelopment" TEXT,
    "conclusion" TEXT,
    "extendedactivity" TEXT,
    "reflection" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- Create iep_template table
CREATE TABLE IF NOT EXISTS "iep_template" (
    "id" TEXT PRIMARY KEY,
    "school" TEXT NOT NULL,
    "student" TEXT NOT NULL,
    "subject" TEXT,
    "term" TEXT,
    "teacher" TEXT,
    "strand" TEXT,
    "substrands" TEXT,
    "strengths" TEXT,
    "needs" TEXT,
    "outcome" TEXT,
    "experience" TEXT,
    "resources" TEXT,
    "methods" TEXT,
    "initiationDate" TEXT,
    "terminationDate" TEXT,
    "reflection" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_school" ON "lesson_plan" ("school");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_subject" ON "lesson_plan" ("subject");
CREATE INDEX IF NOT EXISTS "idx_iep_template_school" ON "iep_template" ("school");
CREATE INDEX IF NOT EXISTS "idx_iep_template_student" ON "iep_template" ("student");
