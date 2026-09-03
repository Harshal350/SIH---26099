package com.sih.materialidentity.controller;

import com.sih.materialidentity.dto.SourceMaterialResponse;
import com.sih.materialidentity.entity.SourceMaterial;
import com.sih.materialidentity.repository.SourceMaterialRepository;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/materials")
public class SourceMaterialController {

    private final SourceMaterialRepository sourceRepo;

    public SourceMaterialController(SourceMaterialRepository sourceRepo) {
        this.sourceRepo = sourceRepo;
    }

    @GetMapping
    public List<SourceMaterialResponse> list() {
        return sourceRepo.findAll(Sort.by(Sort.Direction.DESC, "importTimestamp"))
                .stream().map(SourceMaterialResponse::from).toList();
    }

    @GetMapping("/{id}")
    public SourceMaterialResponse get(@PathVariable Long id) {
        return SourceMaterialResponse.from(sourceRepo.findById(id).orElseThrow());
    }

    @GetMapping("/organizations")
    public List<String> organizations() {
        return sourceRepo.findDistinctSourceOrganizations();
    }
}
