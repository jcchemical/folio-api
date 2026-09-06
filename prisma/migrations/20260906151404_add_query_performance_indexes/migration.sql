-- CreateIndex
CREATE INDEX "BibliographicRecord_workId_createdAt_id_idx" ON "BibliographicRecord"("workId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "BibliographicRecord_editionId_createdAt_id_idx" ON "BibliographicRecord"("editionId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Contributor_createdAt_id_idx" ON "Contributor"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Edition_workId_createdAt_id_idx" ON "Edition"("workId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EditionContributor_editionId_sortOrder_id_idx" ON "EditionContributor"("editionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "EditionContributor_contributorId_idx" ON "EditionContributor"("contributorId");

-- CreateIndex
CREATE INDEX "ExternalIdentifier_editionId_createdAt_id_idx" ON "ExternalIdentifier"("editionId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Institution_userId_createdAt_id_idx" ON "Institution"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Item_editionId_createdAt_id_idx" ON "Item"("editionId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Item_userId_createdAt_id_idx" ON "Item"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Item_institutionId_status_createdAt_id_idx" ON "Item"("institutionId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "User_createdAt_id_idx" ON "User"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Work_userId_createdAt_id_idx" ON "Work"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Work_institutionId_createdAt_id_idx" ON "Work"("institutionId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "WorkContributor_workId_sortOrder_id_idx" ON "WorkContributor"("workId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "WorkContributor_contributorId_idx" ON "WorkContributor"("contributorId");
