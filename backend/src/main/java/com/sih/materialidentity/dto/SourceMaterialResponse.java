package com.sih.materialidentity.dto;

import com.sih.materialidentity.entity.MaterialDna;
import com.sih.materialidentity.entity.SourceMaterial;
import com.sih.materialidentity.entity.enums.MaterialLifecycle;

import java.time.Instant;

public record SourceMaterialResponse(
        Long id,
        String sourceOrganization,
        String sourceType,
        String sourceDocument,
        String sourceUrl,
        String sourceRecordId,
        String originalMaterialCode,
        String originalDescription,
        String originalUom,
        String originalQuantity,
        String normalizedDescription,
        String category,
        MaterialDna dna,
        MaterialLifecycle lifecycle,
        String aiAssessment,
        Instant importTimestamp
) {
    public static SourceMaterialResponse from(SourceMaterial s) {
        return new SourceMaterialResponse(
                s.getId(),
                s.getSourceOrganization(),
                s.getSourceType(),
                s.getSourceDocument(),
                s.getSourceUrl(),
                s.getSourceRecordId(),
                s.getOriginalMaterialCode(),
                s.getOriginalDescription(),
                s.getOriginalUom(),
                s.getOriginalQuantity(),
                s.getNormalizedDescription(),
                s.getDna() != null ? s.getDna().getCategory() : s.getCategory(),
                s.getDna(),
                s.getLifecycle(),
                s.getAiAssessment(),
                s.getImportTimestamp()
        );
    }
}
