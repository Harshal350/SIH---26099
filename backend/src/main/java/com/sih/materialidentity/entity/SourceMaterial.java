package com.sih.materialidentity.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.sih.materialidentity.entity.enums.MaterialLifecycle;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Entity
@Table(name = "source_material", indexes = {
        @Index(name = "idx_source_org", columnList = "source_organization"),
        @Index(name = "idx_source_status", columnList = "lifecycle")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class SourceMaterial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ---- Provenance (mandatory) ----
    @Column(name = "source_organization", nullable = false)
    private String sourceOrganization;

    @Column(name = "source_type")
    private String sourceType;        // TENDER, BOQ, GEM, DATAGOV, CPSE_PORTAL

    @Column(name = "source_document")
    private String sourceDocument;    // file/tender reference

    @Column(name = "source_url")
    private String sourceUrl;

    @Column(name = "source_record_id")
    private String sourceRecordId;    // original row id in source doc

    // ---- Original source values (never overwritten) ----
    @Column(name = "original_material_code", nullable = false)
    private String originalMaterialCode;

    @Column(name = "original_description", nullable = false, columnDefinition = "TEXT")
    private String originalDescription;

    @Column(name = "original_uom")
    private String originalUom;

    @Column(name = "original_quantity")
    private String originalQuantity;

    // ---- Derived/Normalized ----
    @Column(name = "normalized_description", columnDefinition = "TEXT")
    private String normalizedDescription;

    @Column(name = "category")
    private String category;

    @Embedded
    private MaterialDna dna;

    @Column(name = "lifecycle", nullable = false)
    @Enumerated(EnumType.STRING)
    private MaterialLifecycle lifecycle = MaterialLifecycle.PENDING;

    @Column(name = "import_job_id")
    private Long importJobId;

    @Column(name = "embedding", columnDefinition = "TEXT")
    @JsonIgnore
    private String embedding;

    @Column(name = "ai_assessment", columnDefinition = "TEXT")
    private String aiAssessment;

    @Column(name = "data_quality_issues")
    private Integer dataQualityIssueCount = 0;

    @CreatedDate
    @Column(name = "import_timestamp", nullable = false, updatable = false)
    private Instant importTimestamp;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
