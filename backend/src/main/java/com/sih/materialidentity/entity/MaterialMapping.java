package com.sih.materialidentity.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "material_mapping", indexes = {
        @Index(name = "idx_mapping_source", columnList = "source_material_id")
})
@Getter
@Setter
public class MaterialMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_material_id", nullable = false)
    private SourceMaterial sourceMaterial;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "common_material_id")
    private CommonMaterial commonMaterial;

    @Column(name = "mapped_at")
    private Instant mappedAt;

    @Column(name = "mapped_by")
    private String mappedBy;

    @Column(name = "decision", nullable = false)
    private String decision = "APPROVED";  // APPROVED, REJECTED

    @Column(name = "reason")
    private String reason;
}
