package com.sih.materialidentity.repository;

import com.sih.materialidentity.entity.MaterialMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialMappingRepository extends JpaRepository<MaterialMapping, Long> {
    List<MaterialMapping> findByCommonMaterialId(Long commonMaterialId);
}
