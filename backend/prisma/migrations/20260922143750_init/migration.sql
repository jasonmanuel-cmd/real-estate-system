-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "parcels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countyFips" TEXT NOT NULL,
    "countyName" TEXT NOT NULL,
    "apn" TEXT NOT NULL,
    "situsAddress" TEXT NOT NULL,
    "city" TEXT,
    "zip" TEXT,
    "lat" REAL,
    "lng" REAL,
    "propertyType" TEXT NOT NULL,
    "landUseCode" TEXT,
    "lotSize" REAL,
    "buildingSqft" INTEGER,
    "yearBuilt" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" REAL,
    "units" INTEGER,
    "assessedValueTotal" REAL,
    "assessedValueLand" REAL,
    "assessedValueImprovement" REAL,
    "taxYear" INTEGER,
    "ownerId" TEXT,
    "dataSourceName" TEXT,
    "dataSourceDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "parcels_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerNameRaw" TEXT NOT NULL,
    "ownerNameClean" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "mailingAddressStandardized" TEXT,
    "mailingCity" TEXT,
    "mailingState" TEXT,
    "mailingZip" TEXT,
    "entityLookupRefs" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "deeds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcelId" TEXT NOT NULL,
    "recordingDate" DATETIME NOT NULL,
    "docType" TEXT,
    "salePrice" REAL,
    "grantorName" TEXT,
    "granteeName" TEXT,
    "instrumentNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deeds_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "signals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcelId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "signalDate" DATETIME NOT NULL,
    "severity" INTEGER NOT NULL,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signals_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcelId" TEXT NOT NULL,
    "scoreTotal" INTEGER NOT NULL,
    "scoreComponents" TEXT NOT NULL,
    "topReasons" TEXT NOT NULL,
    "confidenceLevel" REAL,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "scores_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "score_weights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signalType" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assignedTo" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    "nextActionAt" DATETIME,
    "arvEstimate" REAL,
    "rentEstimate" REAL,
    "rehabEstimate" REAL,
    "offerRanges" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "leads_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "leads_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "outreach_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "outcome" TEXT,
    "note" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outreach_logs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "comps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countyName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "saleDate" DATETIME NOT NULL,
    "salePrice" REAL NOT NULL,
    "propertyType" TEXT NOT NULL,
    "buildingSqft" INTEGER,
    "lotSize" REAL,
    "bedrooms" INTEGER,
    "bathrooms" REAL,
    "yearBuilt" INTEGER,
    "pricePerSqft" REAL,
    "lat" REAL,
    "lng" REAL,
    "dataSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "etl_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobType" TEXT NOT NULL,
    "countyName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "recordsProcessed" INTEGER,
    "recordsSucceeded" INTEGER,
    "recordsFailed" INTEGER,
    "errorLog" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dnc_list" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerName" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "reason" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "app_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "parcels_apn_key" ON "parcels"("apn");

-- CreateIndex
CREATE INDEX "parcels_countyName_idx" ON "parcels"("countyName");

-- CreateIndex
CREATE INDEX "parcels_propertyType_idx" ON "parcels"("propertyType");

-- CreateIndex
CREATE INDEX "parcels_city_idx" ON "parcels"("city");

-- CreateIndex
CREATE INDEX "parcels_zip_idx" ON "parcels"("zip");

-- CreateIndex
CREATE INDEX "parcels_ownerId_idx" ON "parcels"("ownerId");

-- CreateIndex
CREATE INDEX "owners_ownerNameClean_idx" ON "owners"("ownerNameClean");

-- CreateIndex
CREATE INDEX "owners_mailingAddressStandardized_idx" ON "owners"("mailingAddressStandardized");

-- CreateIndex
CREATE INDEX "deeds_parcelId_idx" ON "deeds"("parcelId");

-- CreateIndex
CREATE INDEX "deeds_recordingDate_idx" ON "deeds"("recordingDate");

-- CreateIndex
CREATE INDEX "signals_parcelId_idx" ON "signals"("parcelId");

-- CreateIndex
CREATE INDEX "signals_signalType_idx" ON "signals"("signalType");

-- CreateIndex
CREATE INDEX "signals_signalDate_idx" ON "signals"("signalDate");

-- CreateIndex
CREATE UNIQUE INDEX "scores_parcelId_key" ON "scores"("parcelId");

-- CreateIndex
CREATE INDEX "scores_scoreTotal_idx" ON "scores"("scoreTotal");

-- CreateIndex
CREATE UNIQUE INDEX "score_weights_signalType_key" ON "score_weights"("signalType");

-- CreateIndex
CREATE UNIQUE INDEX "leads_parcelId_key" ON "leads"("parcelId");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_assignedTo_idx" ON "leads"("assignedTo");

-- CreateIndex
CREATE INDEX "leads_nextActionAt_idx" ON "leads"("nextActionAt");

-- CreateIndex
CREATE INDEX "outreach_logs_leadId_idx" ON "outreach_logs"("leadId");

-- CreateIndex
CREATE INDEX "outreach_logs_timestamp_idx" ON "outreach_logs"("timestamp");

-- CreateIndex
CREATE INDEX "comps_countyName_saleDate_idx" ON "comps"("countyName", "saleDate");

-- CreateIndex
CREATE INDEX "comps_propertyType_idx" ON "comps"("propertyType");

-- CreateIndex
CREATE INDEX "etl_jobs_jobType_status_idx" ON "etl_jobs"("jobType", "status");

-- CreateIndex
CREATE INDEX "etl_jobs_countyName_idx" ON "etl_jobs"("countyName");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "dnc_list_ownerName_idx" ON "dnc_list"("ownerName");

-- CreateIndex
CREATE UNIQUE INDEX "app_config_key_key" ON "app_config"("key");
