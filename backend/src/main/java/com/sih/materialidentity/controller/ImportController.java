package com.sih.materialidentity.controller;

import com.sih.materialidentity.dto.ImportJobResponse;
import com.sih.materialidentity.service.MaterialImportService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/import")
public class ImportController {

    private final MaterialImportService importService;

    public ImportController(MaterialImportService importService) {
        this.importService = importService;
    }

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.CREATED)
    public ImportJobResponse create(@RequestBody Map<String, String> meta) {
        return importService.createJob(meta);
    }

    @PostMapping("/{jobId}/upload")
    public ImportJobResponse upload(@PathVariable Long jobId, @RequestParam("file") MultipartFile file) {
        return importService.importFile(jobId, file);
    }
}
