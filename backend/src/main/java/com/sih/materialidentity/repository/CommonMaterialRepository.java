package com.sih.materialidentity.repository;

import com.sih.materialidentity.entity.CommonMaterial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CommonMaterialRepository extends JpaRepository<CommonMaterial, Long> {
    Optional<CommonMaterial> findByNationalCode(String nationalCode);
}
