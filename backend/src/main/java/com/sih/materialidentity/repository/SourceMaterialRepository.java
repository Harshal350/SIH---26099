package com.sih.materialidentity.repository;

import com.sih.materialidentity.entity.SourceMaterial;
import com.sih.materialidentity.entity.enums.MaterialLifecycle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SourceMaterialRepository extends JpaRepository<SourceMaterial, Long> {

    List<SourceMaterial> findBySourceOrganization(String sourceOrganization);

    long countByLifecycle(MaterialLifecycle lifecycle);

    @Query("select distinct s.sourceOrganization from SourceMaterial s")
    List<String> findDistinctSourceOrganizations();

    @Query("select s from SourceMaterial s where s.lifecycle not in (com.sih.materialidentity.entity.enums.MaterialLifecycle.RETIRED)")
    List<SourceMaterial> findActive();
}
