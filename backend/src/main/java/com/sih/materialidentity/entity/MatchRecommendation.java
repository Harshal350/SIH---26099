package com.sih.materialidentity.entity;

import com.sih.materialidentity.entity.enums.MatchClassification;
import com.sih.materialidentity.entity.enums.MatchStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Entity
@Table(name = "match_recommendation", indexes = {
        @Index(name = "idx_match_status", columnList = "status"),
        @Index(name = "idx_match_class", columnList = "classification")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class MatchRecommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_a_id", nullable = false)
    private SourceMaterial sourceA;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_b_id", nullable = false)
    private SourceMaterial sourceB;

    @Column(name = "confidence", nullable = false)
    private Double confidence;

    @Column(name = "classification", nullable = false)
    @Enumerated(EnumType.STRING)
    private MatchClassification classification;

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    private MatchStatus status = MatchStatus.PENDING;

    @Column(name = "explanation", columnDefinition = "TEXT")
    private String explanation;      // human-readable "why"

    @Column(name = "conflicts", columnDefinition = "TEXT")
    private String conflicts;        // technical conflicts JSON

    @Column(name = "detail_json", columnDefinition = "TEXT")
    private String detailJson;       // advanced breakdown (fuzzy, semantic, attributes)

    @Column(name = "reviewed_by")
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "review_note")
    private String reviewNote;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
