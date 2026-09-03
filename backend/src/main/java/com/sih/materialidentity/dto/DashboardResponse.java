package com.sih.materialidentity.dto;

import java.util.Map;

public record DashboardResponse(
        Long materialsImported,
        Long nationalMaterials,
        Long pendingReviews,
        Long approvedMappings,
        Long dataQualityIssues,
        Long cpseConnected,
        Map<String, Object> extra
) {}
