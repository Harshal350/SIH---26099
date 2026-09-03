package com.sih.materialidentity.dto;

import java.util.Map;

public record HealthResponse(
        String status,
        String service,
        String version,
        Map<String, Object> details
) {}
