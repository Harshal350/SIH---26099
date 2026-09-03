package com.sih.materialidentity.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sih.materialidentity.entity.*;
import com.sih.materialidentity.dto.MatchRecommendationResponse;
import com.sih.materialidentity.entity.enums.MatchStatus;
import com.sih.materialidentity.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class MatchService {

    private final SourceMaterialRepository sourceRepo;
    private final MatchRecommendationRepository matchRepo;
    private final CommonMaterialRepository commonRepo;
    private final MaterialMappingRepository mappingRepo;
    private final AuditEventRepository auditRepo;
    private final AiServiceClient aiClient;
    private final ObjectMapper mapper = new ObjectMapper();

    public MatchService(SourceMaterialRepository sourceRepo,
                        MatchRecommendationRepository matchRepo,
                        CommonMaterialRepository commonRepo,
                        MaterialMappingRepository mappingRepo,
                        AuditEventRepository auditRepo,
                        AiServiceClient aiClient) {
        this.sourceRepo = sourceRepo;
        this.matchRepo = matchRepo;
        this.commonRepo = commonRepo;
        this.mappingRepo = mappingRepo;
        this.auditRepo = auditRepo;
        this.aiClient = aiClient;
    }

    @Transactional
    public List<MatchRecommendation> runMatching() {
        List<SourceMaterial> materials = sourceRepo.findActive();
        List<MatchRecommendation> created = new ArrayList<>();

        // Group by category for candidate generation (blocking)
        for (int i = 0; i < materials.size(); i++) {
            SourceMaterial a = materials.get(i);
            for (int j = i + 1; j < materials.size(); j++) {
                SourceMaterial b = materials.get(j);
                if (a.getSourceOrganization().equals(b.getSourceOrganization())) {
                    // Only cross-CPSE matches in this prototype where organizations differ
                    continue;
                }
                if (!sameCategory(a, b)) continue;

                JsonNode result = aiClient.compareMaterials(
                        a.getOriginalDescription(), dnaAsNode(a.getDna()),
                        b.getOriginalDescription(), dnaAsNode(b.getDna()));

                double confidence = result.path("confidence").asDouble(0.0);
                if (confidence < 0.4) continue;

                // Conflict detection: do not auto-merge
                boolean hasConflict = result.path("has_conflict").asBoolean(false);
                String classification = result.path("classification").asText("POTENTIAL_MATCH");

                MatchRecommendation rec = new MatchRecommendation();
                rec.setSourceA(a);
                rec.setSourceB(b);
                rec.setConfidence(confidence);
                rec.setClassification(parseClassification(classification));
                rec.setStatus(hasConflict ? MatchStatus.ESCALATED : MatchStatus.PENDING);
                rec.setExplanation(result.path("explanation").asText("AI assessment based on description and technical details."));
                if (result.hasNonNull("conflicts")) rec.setConflicts(result.path("conflicts").toString());
                if (result.hasNonNull("detail")) rec.setDetailJson(result.path("detail").toString());
                created.add(matchRepo.save(rec));
            }
        }
        return created;
    }

    @Transactional(readOnly = true)
    public List<MatchRecommendationResponse> pendingReview() {
        return matchRepo.findByStatusOrderByConfidenceDesc(MatchStatus.PENDING)
                .stream().map(MatchRecommendationResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public MatchRecommendationResponse getMatch(Long id) {
        return MatchRecommendationResponse.from(matchRepo.findById(id).orElseThrow());
    }

    @Transactional
    public CommonMaterial approveMatch(Long matchId, String reviewer, String note) {
        MatchRecommendation rec = matchRepo.findById(matchId).orElseThrow();
        rec.setStatus(MatchStatus.APPROVED);
        rec.setReviewedBy(reviewer);
        rec.setReviewedAt(Instant.now());
        rec.setReviewNote(note);

        // Create or reuse a National Material (golden record)
        CommonMaterial common = findOrCreateCommon(rec.getSourceA(), rec.getSourceB(), reviewer);
        linkSource(rec.getSourceA(), common, reviewer);
        linkSource(rec.getSourceB(), common, reviewer);

        matchRepo.save(rec);

        AuditEvent audit = new AuditEvent();
        audit.setActor(reviewer);
        audit.setAction("MATCH_APPROVED");
        audit.setEntityType("MATCH_RECOMMENDATION");
        audit.setEntityId(matchId);
        audit.setAfterState("Approved and linked to " + common.getNationalCode());
        audit.setReason(note);
        auditRepo.save(audit);

        return common;
    }

    @Transactional
    public void rejectMatch(Long matchId, String reviewer, String note) {
        MatchRecommendation rec = matchRepo.findById(matchId).orElseThrow();
        rec.setStatus(MatchStatus.REJECTED);
        rec.setReviewedBy(reviewer);
        rec.setReviewedAt(Instant.now());
        rec.setReviewNote(note);
        matchRepo.save(rec);

        AuditEvent audit = new AuditEvent();
        audit.setActor(reviewer);
        audit.setAction("MATCH_REJECTED");
        audit.setEntityType("MATCH_RECOMMENDATION");
        audit.setEntityId(matchId);
        audit.setReason(note);
        auditRepo.save(audit);
    }

    @Transactional
    public void escalateMatch(Long matchId, String reviewer, String note) {
        MatchRecommendation rec = matchRepo.findById(matchId).orElseThrow();
        rec.setStatus(MatchStatus.ESCALATED);
        rec.setReviewedBy(reviewer);
        rec.setReviewNote(note);
        matchRepo.save(rec);

        AuditEvent audit = new AuditEvent();
        audit.setActor(reviewer);
        audit.setAction("REVIEW_ESCALATED");
        audit.setEntityType("MATCH_RECOMMENDATION");
        audit.setEntityId(matchId);
        audit.setReason(note);
        auditRepo.save(audit);
    }

    private CommonMaterial findOrCreateCommon(SourceMaterial a, SourceMaterial b, String reviewer) {
        long count = commonRepo.count();
        CommonMaterial common = new CommonMaterial();
        common.setNationalCode(String.format("NMC-%06d", count + 1));
        common.setStandardizedDescription(buildStandardDescription(a, b));
        common.setDna(preferredDna(a, b));
        common.setStatus(com.sih.materialidentity.entity.enums.MaterialLifecycle.APPROVED);
        common.setApprovedBy(reviewer);
        common.setApprovedAt(Instant.now());
        common.setAiAssessment("Created from approved match linking source records across CPSEs.");
        return commonRepo.save(common);
    }

    private String buildStandardDescription(SourceMaterial a, SourceMaterial b) {
        String aDesc = a.getNormalizedDescription() != null ? a.getNormalizedDescription() : a.getOriginalDescription();
        String bDesc = b.getNormalizedDescription() != null ? b.getNormalizedDescription() : b.getOriginalDescription();
        return aDesc.length() <= bDesc.length() ? aDesc : bDesc;
    }

    private MaterialDna preferredDna(SourceMaterial a, SourceMaterial b) {
        return a.getDna() != null && (a.getDna().getDiameter() != null || a.getDna().getMaterial() != null)
                ? a.getDna() : (b.getDna() != null ? b.getDna() : new MaterialDna());
    }

    private void linkSource(SourceMaterial sm, CommonMaterial common, String reviewer) {
        sm.setLifecycle(com.sih.materialidentity.entity.enums.MaterialLifecycle.APPROVED);
        sourceRepo.save(sm);
        MaterialMapping m = new MaterialMapping();
        m.setSourceMaterial(sm);
        m.setCommonMaterial(common);
        m.setMappedAt(Instant.now());
        m.setMappedBy(reviewer);
        m.setDecision("APPROVED");
        mappingRepo.save(m);
    }

    private boolean sameCategory(SourceMaterial a, SourceMaterial b) {
        String ca = a.getDna() != null ? a.getDna().getCategory() : a.getCategory();
        String cb = b.getDna() != null ? b.getDna().getCategory() : b.getCategory();
        if (ca == null || cb == null) return true;
        return ca.equalsIgnoreCase(cb);
    }

    private JsonNode dnaAsNode(MaterialDna d) {
        if (d == null) return mapper.createObjectNode();
        return mapper.valueToTree(d);
    }

    private com.sih.materialidentity.entity.enums.MatchClassification parseClassification(String c) {
        try {
            return com.sih.materialidentity.entity.enums.MatchClassification.valueOf(c);
        } catch (Exception e) {
            return com.sih.materialidentity.entity.enums.MatchClassification.POTENTIAL_MATCH;
        }
    }
}
