-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('GOOGLE_SKKU', 'EMAIL_OTP');

-- CreateEnum
CREATE TYPE "ScholarshipSource" AS ENUM ('CAMPUS', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ScholarshipType" AS ENUM ('TUITION', 'LIVING');

-- CreateEnum
CREATE TYPE "ApplyStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('ELIGIBLE', 'CONDITIONAL', 'INELIGIBLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "studentId" TEXT,
    "department" TEXT,
    "authMethod" "AuthMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gradeLevel" INTEGER,
    "gpaRecentSemester" DOUBLE PRECISION,
    "gpaCumulative" DOUBLE PRECISION,
    "creditsRecent" INTEGER,
    "incomeBracket" INTEGER,
    "specialStatus" TEXT[],
    "rawExtraction" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scholarship" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "ScholarshipSource" NOT NULL,
    "type" "ScholarshipType" NOT NULL,
    "amount" TEXT NOT NULL,
    "eligibilityRules" JSONB NOT NULL,
    "requiredDocs" TEXT[],
    "applyStart" TIMESTAMP(3),
    "applyEnd" TIMESTAMP(3),
    "officialUrl" TEXT,
    "pdfFormUrl" TEXT,
    "duplicateConflictRules" JSONB,
    "riskFlags" TEXT[],
    "status" "ApplyStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL,
    "reasonText" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlLog" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "scholarshipId" TEXT,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawSnapshot" JSONB NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CrawlLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatus" ADD CONSTRAINT "ApplicationStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatus" ADD CONSTRAINT "ApplicationStatus_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
