package com.sih.materialidentity.repository;

import com.sih.materialidentity.entity.ImportJob;
import com.sih.materialidentity.entity.enums.ImportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ImportJobRepository extends JpaRepository<ImportJob, Long> {
    long countByStatus(ImportStatus status);
}
