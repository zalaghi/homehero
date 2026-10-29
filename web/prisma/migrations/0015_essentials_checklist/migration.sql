-- CreateTable
CREATE TABLE "EssentialSuggestion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EssentialSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeEssentialNeed" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "suggestionId" TEXT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEssentialNeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EssentialSuggestion_normalizedName_key" ON "EssentialSuggestion"("normalizedName");

-- CreateIndex
CREATE INDEX "EssentialSuggestion_isActive_name_idx" ON "EssentialSuggestion"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeEssentialNeed_employeeId_normalizedName_key" ON "EmployeeEssentialNeed"("employeeId", "normalizedName");

-- CreateIndex
CREATE INDEX "EmployeeEssentialNeed_employeeId_createdAt_idx" ON "EmployeeEssentialNeed"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeeEssentialNeed_suggestionId_idx" ON "EmployeeEssentialNeed"("suggestionId");

-- AddForeignKey
ALTER TABLE "EmployeeEssentialNeed" ADD CONSTRAINT "EmployeeEssentialNeed_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEssentialNeed" ADD CONSTRAINT "EmployeeEssentialNeed_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "EssentialSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing global essentials into the lightweight suggestion dictionary.
WITH old_items AS (
    SELECT DISTINCT ON (normalized_name)
        "name",
        normalized_name,
        "isActive",
        "createdAt",
        "updatedAt"
    FROM (
        SELECT
            "name",
            regexp_replace(lower(btrim("name")), '[[:space:]]+', ' ', 'g') AS normalized_name,
            "isActive",
            "createdAt",
            "updatedAt"
        FROM "EssentialItem"
        WHERE btrim("name") <> ''
    ) source_items
    ORDER BY normalized_name, "isActive" DESC, "updatedAt" DESC
)
INSERT INTO "EssentialSuggestion" ("id", "name", "normalizedName", "isActive", "createdAt", "updatedAt")
SELECT
    'legacy-suggestion-' || md5(normalized_name),
    "name",
    normalized_name,
    "isActive",
    "createdAt",
    "updatedAt"
FROM old_items
ON CONFLICT ("normalizedName") DO NOTHING;

-- Migrate current NEED_TO_BUY statuses into the new per-employee checklist.
WITH old_needs AS (
    SELECT DISTINCT ON (old_status."employeeId", normalized_name)
        old_status."employeeId",
        item."name",
        normalized_name,
        old_status."updatedAt"
    FROM (
        SELECT
            existing_status.*,
            regexp_replace(lower(btrim(item."name")), '[[:space:]]+', ' ', 'g') AS normalized_name
        FROM "EssentialStatus" existing_status
        INNER JOIN "EssentialItem" item ON item."id" = existing_status."essentialItemId"
        WHERE existing_status."status" = 'NEED_TO_BUY'
          AND btrim(item."name") <> ''
    ) old_status
    INNER JOIN "EssentialItem" item ON item."id" = old_status."essentialItemId"
    ORDER BY old_status."employeeId", normalized_name, old_status."updatedAt" DESC
)
INSERT INTO "EmployeeEssentialNeed" ("id", "employeeId", "suggestionId", "name", "normalizedName", "createdAt", "updatedAt")
SELECT
    'legacy-need-' || md5(old_needs."employeeId" || ':' || old_needs.normalized_name),
    old_needs."employeeId",
    suggestion."id",
    old_needs."name",
    old_needs.normalized_name,
    old_needs."updatedAt",
    old_needs."updatedAt"
FROM old_needs
LEFT JOIN "EssentialSuggestion" suggestion ON suggestion."normalizedName" = old_needs.normalized_name
ON CONFLICT ("employeeId", "normalizedName") DO NOTHING;
