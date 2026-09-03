package com.sih.materialidentity.entity;

import com.sih.materialidentity.entity.enums.QualitySeverity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Entity
@Table(name = "data_quality_issue", indexes = {
        @Index(name = "idx_dq_severity", columnList = "severity"),
        @Index(name = "idx_dq_type", columnList = "issue_type")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class DataQualityIssue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_material_id")
    private Long sourceMaterialId;

    @Column(name = "issue_type", nullable = false)
    private String issueType;     // MISSING_GRADE, INVALID_UNIT, DUPLICATE_SOURCE_CODE, MISSING_DESCRIPTION

    @Column(name = "severity", nullable = false)
    @Enumerated(EnumType.STRING)
    private QualitySeverity severity;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "resolved", nullable = false)
    private Boolean resolved = false;

    @Column(name = "resolution_note")
    private String resolutionNote;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
