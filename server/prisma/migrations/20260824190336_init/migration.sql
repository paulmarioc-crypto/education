-- CreateEnum
CREATE TYPE "ConceptKind" AS ENUM ('SYSTEM', 'REGION', 'STRUCTURE', 'DIAGNOSIS', 'TOPIC');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('FLASHCARD', 'DIAGNOSIS_CASE', 'ANATOMY_ID', 'QUIZ_QUESTION');

-- CreateEnum
CREATE TYPE "ItemSource" AS ENUM ('SEED', 'MANUAL', 'AI_UPLOAD', 'AI_TOPIC');

-- CreateEnum
CREATE TYPE "Module" AS ENUM ('DIAGNOSIS', 'ANATOMY', 'QUIZ', 'REVIEW');

-- CreateTable
CREATE TABLE "ConceptNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ConceptKind" NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "module" "Module" NOT NULL,
    "prompt" TEXT NOT NULL,
    "answerKey" TEXT NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source" "ItemSource" NOT NULL DEFAULT 'MANUAL',
    "sourceRef" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemConcept" (
    "itemId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,

    CONSTRAINT "ItemConcept_pkey" PRIMARY KEY ("itemId","conceptId")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "selectedAnswer" TEXT NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "module" "Module" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfusionPair" (
    "id" TEXT NOT NULL,
    "conceptAId" TEXT NOT NULL,
    "conceptBId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "correctStreak" INTEGER NOT NULL DEFAULT 0,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfusionPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasteryScore" (
    "conceptId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasteryScore_pkey" PRIMARY KEY ("conceptId")
);

-- CreateTable
CREATE TABLE "ReviewState" (
    "itemId" TEXT NOT NULL,
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elapsedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scheduledDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" INTEGER NOT NULL DEFAULT 0,
    "lastReview" TIMESTAMP(3),

    CONSTRAINT "ReviewState_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "StreakState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StreakState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extractedText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConceptNode_parentId_idx" ON "ConceptNode"("parentId");

-- CreateIndex
CREATE INDEX "Item_type_idx" ON "Item"("type");

-- CreateIndex
CREATE INDEX "Item_module_idx" ON "Item"("module");

-- CreateIndex
CREATE INDEX "ItemConcept_conceptId_idx" ON "ItemConcept"("conceptId");

-- CreateIndex
CREATE INDEX "Attempt_itemId_idx" ON "Attempt"("itemId");

-- CreateIndex
CREATE INDEX "Attempt_createdAt_idx" ON "Attempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConfusionPair_conceptAId_conceptBId_key" ON "ConfusionPair"("conceptAId", "conceptBId");

-- CreateIndex
CREATE INDEX "ReviewState_due_idx" ON "ReviewState"("due");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- AddForeignKey
ALTER TABLE "ConceptNode" ADD CONSTRAINT "ConceptNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ConceptNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemConcept" ADD CONSTRAINT "ItemConcept_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemConcept" ADD CONSTRAINT "ItemConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "ConceptNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfusionPair" ADD CONSTRAINT "ConfusionPair_conceptAId_fkey" FOREIGN KEY ("conceptAId") REFERENCES "ConceptNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfusionPair" ADD CONSTRAINT "ConfusionPair_conceptBId_fkey" FOREIGN KEY ("conceptBId") REFERENCES "ConceptNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryScore" ADD CONSTRAINT "MasteryScore_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "ConceptNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewState" ADD CONSTRAINT "ReviewState_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
