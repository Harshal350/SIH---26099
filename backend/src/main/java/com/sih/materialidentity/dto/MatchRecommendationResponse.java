package com.sih.materialidentity.dto;

import com.sih.materialidentity.entity.MatchRecommendation;
import com.sih.materialidentity.entity.enums.MatchClassification;
import com.sih.materialidentity.entity.enums.MatchStatus;

public record MatchRecommendationResponse(
        Long id,
        SourceMaterialResponse sourceA,
        SourceMaterialResponse sourceB,
        Double confidence,
        MatchClassification classification,
        MatchStatus status,
        String explanation,
        String conflicts,
        String detailJson,
        String reviewNote
) {
    public static MatchRecommendationResponse from(MatchRecommendation m) {
        return new MatchRecommendationResponse(
                m.getId(),
                SourceMaterialResponse.from(m.getSourceA()),
                SourceMaterialResponse.from(m.getSourceB()),
                m.getConfidence(),
                m.getClassification(),
                m.getStatus(),
                m.getExplanation(),
                m.getConflicts(),
                m.getDetailJson(),
                m.getReviewNote()
        );
    }
}
