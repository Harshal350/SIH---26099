package com.sih.materialidentity.service;

import com.sih.materialidentity.dto.DashboardResponse;
import com.sih.materialidentity.entity.enums.ImportStatus;
import com.sih.materialidentity.entity.enums.MatchStatus;
import com.sih.materialidentity.repository.*;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class DashboardService {

    private final SourceMaterialRepository sourceRepo;
    private final CommonMaterialRepository commonRepo;
    private final MatchRecommendationRepository matchRepo;
    private final DataQualityIssueRepository dqRepo;

    public DashboardService(SourceMaterialRepository sourceRepo,
                            CommonMaterialRepository commonRepo,
                            MatchRecommendationRepository matchRepo,
                            DataQualityIssueRepository dqRepo) {
        this.sourceRepo = sourceRepo;
        this.commonRepo = commonRepo;
        this.matchRepo = matchRepo;
        this.dqRepo = dqRepo;
    }

    public DashboardResponse get() {
        long pending = matchRepo.countByStatus(MatchStatus.PENDING);
        long approvedMappings = matchRepo.countByStatus(MatchStatus.APPROVED);
        long issues = dqRepo.countByResolved(false);
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("escalatedMatches", matchRepo.countByStatus(MatchStatus.ESCALATED));
        extra.put("completedRecords", sourceRepo.count());
        return new DashboardResponse(
                sourceRepo.count(),
                commonRepo.count(),
                pending,
                approvedMappings,
                issues,
                (long) sourceRepo.findDistinctSourceOrganizations().size(),
                extra);
    }
}
