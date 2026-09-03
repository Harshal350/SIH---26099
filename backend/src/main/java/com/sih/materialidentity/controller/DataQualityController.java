package com.sih.materialidentity.controller;

import com.sih.materialidentity.entity.DataQualityIssue;
import com.sih.materialidentity.service.DataQualityService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/data-quality")
public class DataQualityController {

    private final DataQualityService dqService;

    public DataQualityController(DataQualityService dqService) {
        this.dqService = dqService;
    }

    @GetMapping
    public List<DataQualityIssue> list() {
        return dqService.list();
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        return dqService.summary();
    }
}
