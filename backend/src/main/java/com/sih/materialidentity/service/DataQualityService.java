package com.sih.materialidentity.service;

import com.sih.materialidentity.entity.DataQualityIssue;
import com.sih.materialidentity.entity.enums.QualitySeverity;
import com.sih.materialidentity.repository.DataQualityIssueRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DataQualityService {

    private final DataQualityIssueRepository dqRepo;

    public DataQualityService(DataQualityIssueRepository dqRepo) {
        this.dqRepo = dqRepo;
    }

    public List<DataQualityIssue> list() {
        return dqRepo.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
    }

    public Map<String, Object> summary() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("complete", dqRepo.countBySeverity(QualitySeverity.COMPLETE));
        map.put("warnings", dqRepo.countBySeverity(QualitySeverity.WARNING));
        map.put("errors", dqRepo.countBySeverity(QualitySeverity.ERROR));
        map.put("resolved", dqRepo.countByResolved(true));
        map.put("open", dqRepo.countByResolved(false));
        return map;
    }
}
