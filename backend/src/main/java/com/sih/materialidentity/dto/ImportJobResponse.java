package com.sih.materialidentity.dto;

import com.sih.materialidentity.entity.enums.ImportStatus;

import java.time.Instant;

public record ImportJobResponse(
        Long id,
        String fileName,
        String sourceOrganization,
        String sourceType,
        String sourceDocument,
        String sourceUrl,
        ImportStatus status,
        Integer totalRecords,
        Integer validRecords,
        Integer invalidRecords,
        Integer importedRecords,
        String errorMessage,
        Instant createdAt
) {}
