package com.sih.materialidentity.entity;

import com.sih.materialidentity.entity.enums.MaterialLifecycle;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "common_material", indexes = {
        @Index(name = "idx_nmc", columnList = "national_code", unique = true)
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class CommonMaterial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "national_code", nullable = false, unique = true)
    private String nationalCode;      // NMC-000001

    @Column(name = "standardized_description", nullable = false, columnDefinition = "TEXT")
    private String standardizedDescription;

    @Embedded
    private MaterialDna dna;

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    private MaterialLifecycle status = MaterialLifecycle.APPROVED;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "ai_assessment", columnDefinition = "TEXT")
    private String aiAssessment;

    @OneToMany(mappedBy = "commonMaterial", cascade = CascadeType.ALL)
    private List<MaterialMapping> mappings = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
