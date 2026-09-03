package com.sih.materialidentity.repository;

import com.sih.materialidentity.entity.DataQualityIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DataQualityIssueRepository extends JpaRepository<DataQualityIssue, Long> {
    long countBySeverity(com.sih.materialidentity.entity.enums.QualitySeverity severity);
    long countByResolved(Boolean resolved);
}
