package com.sih.materialidentity.dto;

import com.sih.materialidentity.entity.CommonMaterial;
import com.sih.materialidentity.entity.MaterialDna;
import com.sih.materialidentity.entity.enums.MaterialLifecycle;

import java.time.Instant;
import java.util.List;

public record CommonMaterialResponse(
        Long id,
        String nationalCode,
        String standardizedDescription,
        MaterialDna dna,
        MaterialLifecycle status,
        String approvedBy,
        Instant approvedAt,
        String aiAssessment,
        List<MaterialMappingResponse> mappings,
        Instant createdAt
) {
    public static CommonMaterialResponse from(CommonMaterial c) {
        return new CommonMaterialResponse(
                c.getId(),
                c.getNationalCode(),
                c.getStandardizedDescription(),
                c.getDna(),
                c.getStatus(),
                c.getApprovedBy(),
                c.getApprovedAt(),
                c.getAiAssessment(),
                c.getMappings() == null ? List.of()
                        : c.getMappings().stream().map(MaterialMappingResponse::from).toList(),
                c.getCreatedAt()
        );
    }
}
