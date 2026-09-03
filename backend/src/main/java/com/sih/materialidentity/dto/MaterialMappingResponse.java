package com.sih.materialidentity.dto;

import com.sih.materialidentity.entity.MaterialMapping;

import java.time.Instant;

public record MaterialMappingResponse(
        Long id,
        SourceMaterialResponse sourceMaterial,
        Long commonMaterialId,
        Instant mappedAt,
        String mappedBy,
        String decision,
        String reason
) {
    public static MaterialMappingResponse from(MaterialMapping m) {
        return new MaterialMappingResponse(
                m.getId(),
                m.getSourceMaterial() != null ? SourceMaterialResponse.from(m.getSourceMaterial()) : null,
                m.getCommonMaterial() != null ? m.getCommonMaterial().getId() : null,
                m.getMappedAt(),
                m.getMappedBy(),
                m.getDecision(),
                m.getReason()
        );
    }
}
