package com.sih.materialidentity.controller;

import com.sih.materialidentity.dto.MatchRecommendationResponse;
import com.sih.materialidentity.entity.CommonMaterial;
import com.sih.materialidentity.service.MatchService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/matching")
public class MatchController {

    private final MatchService matchService;

    public MatchController(MatchService matchService) {
        this.matchService = matchService;
    }

    @PostMapping("/run")
    public Map<String, Object> run() {
        int created = matchService.runMatching().size();
        return Map.of("created", created);
    }

    @GetMapping("/pending")
    public List<MatchRecommendationResponse> pending() {
        return matchService.pendingReview();
    }

    @PostMapping("/{id}/approve")
    public CommonMaterial approve(@PathVariable Long id,
                                  @RequestParam(defaultValue = "system") String reviewer,
                                  @RequestBody(required = false) Map<String, String> body) {
        String note = body != null ? body.getOrDefault("note", "") : "";
        return matchService.approveMatch(id, reviewer, note);
    }

    @PostMapping("/{id}/reject")
    public void reject(@PathVariable Long id,
                       @RequestParam(defaultValue = "system") String reviewer,
                       @RequestBody(required = false) Map<String, String> body) {
        String note = body != null ? body.getOrDefault("note", "") : "";
        matchService.rejectMatch(id, reviewer, note);
    }

    @PostMapping("/{id}/escalate")
    public void escalate(@PathVariable Long id,
                         @RequestParam(defaultValue = "system") String reviewer,
                         @RequestBody(required = false) Map<String, String> body) {
        String note = body != null ? body.getOrDefault("note", "") : "";
        matchService.escalateMatch(id, reviewer, note);
    }
}
