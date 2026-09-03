package com.sih.materialidentity.controller;

import com.sih.materialidentity.dto.CommonMaterialResponse;
import com.sih.materialidentity.dto.MaterialMappingResponse;
import com.sih.materialidentity.repository.CommonMaterialRepository;
import com.sih.materialidentity.repository.MaterialMappingRepository;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master")
public class CommonMaterialController {

    private final CommonMaterialRepository commonRepo;
    private final MaterialMappingRepository mappingRepo;

    public CommonMaterialController(CommonMaterialRepository commonRepo, MaterialMappingRepository mappingRepo) {
        this.commonRepo = commonRepo;
        this.mappingRepo = mappingRepo;
    }

    @GetMapping
    public List<CommonMaterialResponse> list() {
        return commonRepo.findAll(Sort.by(Sort.Direction.ASC, "nationalCode"))
                .stream().map(CommonMaterialResponse::from).toList();
    }

    @GetMapping("/{id}")
    public CommonMaterialResponse get(@PathVariable Long id) {
        return CommonMaterialResponse.from(commonRepo.findById(id).orElseThrow());
    }

    @GetMapping("/{id}/sources")
    public List<MaterialMappingResponse> sources(@PathVariable Long id) {
        return mappingRepo.findByCommonMaterialId(id)
                .stream().map(MaterialMappingResponse::from).toList();
    }
}
