package com.sih.materialidentity.controller;

import com.sih.materialidentity.entity.SourceMaterial;
import com.sih.materialidentity.repository.SourceMaterialRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/api/procurement")
public class ProcurementController {

    private final SourceMaterialRepository sourceRepo;

    public ProcurementController(SourceMaterialRepository sourceRepo) {
        this.sourceRepo = sourceRepo;
    }

    @GetMapping
    public Map<String, Object> insights() {
        List<SourceMaterial> all = sourceRepo.findAll();
        Map<String, List<SourceMaterial>> byCategory = new TreeMap<>();
        for (SourceMaterial s : all) {
            String cat = s.getDna() != null && s.getDna().getCategory() != null
                    ? s.getDna().getCategory() : (s.getCategory() != null ? s.getCategory() : "GENERAL");
            byCategory.computeIfAbsent(cat, k -> new ArrayList<>()).add(s);
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map.Entry<String, List<SourceMaterial>> e : byCategory.entrySet()) {
            Set<String> cpse = new TreeSet<>();
            double qty = 0;
            for (SourceMaterial s : e.getValue()) {
                cpse.add(s.getSourceOrganization());
                qty += parseQty(s.getOriginalQuantity());
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("category", e.getKey());
            row.put("records", e.getValue().size());
            row.put("cpseCount", cpse.size());
            row.put("cpse", cpse);
            row.put("quantity", qty);
            rows.add(row);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("categories", rows);
        result.put("totalRecords", all.size());
        result.put("totalCpse", sourceRepo.findDistinctSourceOrganizations().size());
        result.put("note", "Aggregated demand visibility is based only on real imported procurement records. " +
                "It does not claim guaranteed savings.");
        return result;
    }

    private double parseQty(String q) {
        if (q == null || q.trim().isEmpty()) return 0;
        try {
            String num = q.trim().replaceAll("[^0-9.\\-]", "");
            return num.isEmpty() ? 0 : Double.parseDouble(num);
        } catch (Exception ignored) {
            return 0;
        }
    }
}
