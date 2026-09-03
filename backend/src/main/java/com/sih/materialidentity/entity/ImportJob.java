package com.sih.materialidentity.entity;

import com.sih.materialidentity.entity.enums.ImportStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Entity
@Table(name = "import_job")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class ImportJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "source_organization", nullable = false)
    private String sourceOrganization;

    @Column(name = "source_type")
    private String sourceType;

    @Column(name = "source_document")
    private String sourceDocument;

    @Column(name = "source_url")
    private String sourceUrl;

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    private ImportStatus status = ImportStatus.UPLOADED;

    @Column(name = "total_records")
    private Integer totalRecords = 0;

    @Column(name = "valid_records")
    private Integer validRecords = 0;

    @Column(name = "invalid_records")
    private Integer invalidRecords = 0;

    @Column(name = "imported_records")
    private Integer importedRecords = 0;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "uploaded_by")
    private String uploadedBy;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
