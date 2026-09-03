package com.sih.materialidentity.repository;

import com.sih.materialidentity.entity.MatchRecommendation;
import com.sih.materialidentity.entity.enums.MatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MatchRecommendationRepository extends JpaRepository<MatchRecommendation, Long> {
    long countByStatus(MatchStatus status);
    List<MatchRecommendation> findByStatusOrderByConfidenceDesc(MatchStatus status);
}
