package com.sih.materialidentity.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sih.materialidentity.dto.ImportJobResponse;
import com.sih.materialidentity.entity.*;
import com.sih.materialidentity.entity.enums.ImportStatus;
import com.sih.materialidentity.entity.enums.MaterialLifecycle;
import com.sih.materialidentity.entity.enums.QualitySeverity;
import com.sih.materialidentity.repository.*;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class MaterialImportService {

    private final SourceMaterialRepository sourceRepo;
    private final ImportJobRepository jobRepo;
    private final DataQualityIssueRepository dqRepo;
    private final AuditEventRepository auditRepo;
    private final AiServiceClient aiClient;
    private final ObjectMapper mapper = new ObjectMapper();

    private static final Set<String> KNOWN_UOMS = Set.of(
            "EA", "NOS", "SET", "KG", "MT", "M", "SQ M", "CU M", "PAIR", "ROLL", "NO",
            "LTR", "L", "MM", "CM", "TON", "BOX", "PKT", "BUNDLE", "DRUM", "PCS", "UNIT"
    );

    public MaterialImportService(SourceMaterialRepository sourceRepo,
                                 ImportJobRepository jobRepo,
                                 DataQualityIssueRepository dqRepo,
                                 AuditEventRepository auditRepo,
                                 AiServiceClient aiClient) {
        this.sourceRepo = sourceRepo;
        this.jobRepo = jobRepo;
        this.dqRepo = dqRepo;
        this.auditRepo = auditRepo;
        this.aiClient = aiClient;
    }

    public ImportJobResponse createJob(Map<String, String> meta) {
        ImportJob job = new ImportJob();
        job.setSourceOrganization(meta.getOrDefault("sourceOrganization", "UNKNOWN_CPSE"));
        job.setSourceType(meta.getOrDefault("sourceType", "TENDER"));
        job.setSourceDocument(meta.get("sourceDocument"));
        job.setSourceUrl(meta.get("sourceUrl"));
        job.setFileName(meta.get("fileName"));
        job.setUploadedBy(meta.getOrDefault("uploadedBy", "system"));
        job = jobRepo.save(job);
        return mapJob(job);
    }

    @Transactional
    public ImportJobResponse importFile(Long jobId, MultipartFile file) {
        ImportJob job = jobRepo.findById(jobId).orElseThrow();
        job.setStatus(ImportStatus.VALIDATING);
        jobRepo.save(job);

        try {
            List<Map<String, String>> rows = parseFile(file);
            job.setTotalRecords(rows.size());
            int valid = 0, invalid = 0, saved = 0;

            for (Map<String, String> row : rows) {
                String code = row.getOrDefault("material_code", row.getOrDefault("code", ""));
                String desc = row.getOrDefault("description", row.getOrDefault("material_description", ""));
                String uom = row.getOrDefault("uom", row.getOrDefault("unit", ""));
                String qty = row.getOrDefault("quantity", row.getOrDefault("qty", ""));

                if (code.trim().isEmpty() && desc.trim().isEmpty()) {
                    invalid++;
                    continue;
                }

                SourceMaterial sm = new SourceMaterial();
                sm.setSourceOrganization(job.getSourceOrganization());
                sm.setSourceType(job.getSourceType());
                sm.setSourceDocument(job.getSourceDocument());
                sm.setSourceUrl(job.getSourceUrl());
                sm.setSourceRecordId(row.get("record_id"));
                sm.setOriginalMaterialCode(code.trim());
                sm.setOriginalDescription(desc.trim());
                sm.setOriginalUom(uom.trim());
                sm.setOriginalQuantity(qty.trim());
                sm.setImportJobId(jobId);
                sm.setLifecycle(MaterialLifecycle.PENDING);

                // AI analysis for normalization + DNA
                JsonNode analysis = aiClient.analyzeDescription(desc);
                String normalized = analysis.path("normalized").asText(null);
                sm.setNormalizedDescription(normalized != null ? normalized : normalizeLocal(desc));
                String category = analysis.path("dna").path("category").asText(null);
                if (category == null) category = guessCategory(desc);
                sm.setCategory(category);
                sm.setDna(toDna(analysis.path("dna")));

                // Provenance: never overwrite original
                sm = sourceRepo.save(sm);
                saved++;

                // Data quality
                int issues = 0;
                if (dnaGrade(analysis.path("dna")).isEmpty()) {
                    dqRepo.save(issue(sm.getId(), "MISSING_GRADE", QualitySeverity.WARNING,
                            "This material does not contain a grade."));
                    issues++;
                }
                if (!uom.trim().isEmpty() && !KNOWN_UOMS.contains(uom.trim().toUpperCase())) {
                    dqRepo.save(issue(sm.getId(), "INVALID_UNIT", QualitySeverity.WARNING,
                            "Unit '" + uom + "' is not in the recognized unit list."));
                    issues++;
                }
                if (code.trim().isEmpty()) {
                    dqRepo.save(issue(sm.getId(), "MISSING_CODE", QualitySeverity.WARNING,
                            "Material code not provided in source."));
                    issues++;
                }
                sm.setDataQualityIssueCount(issues);
                sourceRepo.save(sm);
                valid++;
            }

            job.setValidRecords(valid);
            job.setInvalidRecords(invalid);
            job.setImportedRecords(saved);
            job.setStatus(invalid > 0 ? ImportStatus.PARTIAL : ImportStatus.IMPORTED);
            jobRepo.save(job);

            AuditEvent audit = new AuditEvent();
            audit.setActor(job.getUploadedBy());
            audit.setAction("SOURCE_IMPORTED");
            audit.setEntityType("IMPORT_JOB");
            audit.setEntityId(job.getId());
            audit.setAfterState("Imported " + saved + " records from " + job.getFileName());
            auditRepo.save(audit);

            return mapJob(job);
        } catch (Exception e) {
            job.setStatus(ImportStatus.FAILED);
            job.setErrorMessage(e.getMessage());
            jobRepo.save(job);
            return mapJob(job);
        }
    }

    private List<Map<String, String>> parseFile(MultipartFile file) throws Exception {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        if (name.endsWith(".csv")) {
            return parseCsv(file);
        }
        return parseExcel(file);
    }

    private List<Map<String, String>> parseCsv(MultipartFile file) throws Exception {
        List<Map<String, String>> rows = new ArrayList<>();
        Reader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
        try (CSVParser parser = new CSVParser(reader, CSVFormat.DEFAULT.withFirstRecordAsHeader())) {
            for (CSVRecord rec : parser) {
                Map<String, String> map = new LinkedHashMap<>();
                rec.toMap().forEach((k, v) -> map.put(normKey(k), v == null ? "" : v.trim()));
                map.put("record_id", String.valueOf(rec.getRecordNumber()));
                rows.add(map);
            }
        }
        return rows;
    }

    private List<Map<String, String>> parseExcel(MultipartFile file) throws Exception {
        List<Map<String, String>> rows = new ArrayList<>();
        try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            Row header = sheet.getRow(0);
            Map<Integer, String> headers = new HashMap<>();
            if (header != null) {
                for (Cell c : header) {
                    headers.put(c.getColumnIndex(), normKey(cellString(c)));
                }
            }
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                Map<String, String> map = new LinkedHashMap<>();
                boolean any = false;
                for (Cell c : row) {
                    String val = cellString(c);
                    String k = headers.getOrDefault(c.getColumnIndex(), "col" + c.getColumnIndex());
                    map.put(k, val);
                    if (!val.isEmpty()) any = true;
                }
                if (!any) continue;
                map.put("record_id", String.valueOf(r + 1));
                rows.add(map);
            }
        }
        return rows;
    }

    private String cellString(Cell c) {
        if (c == null) return "";
        return switch (c.getCellType()) {
            case STRING -> c.getStringCellValue().trim();
            case NUMERIC -> {
                double d = c.getNumericCellValue();
                yield (d == Math.floor(d)) ? String.valueOf((long) d) : String.valueOf(d);
            }
            default -> "";
        };
    }

    private String normKey(String k) {
        return k == null ? "" : k.toLowerCase().replaceAll("[^a-z0-9]", "_").replaceAll("_+", "_").replaceAll("^_|_$", "");
    }

    private MaterialDna toDna(JsonNode dna) {
        MaterialDna d = new MaterialDna();
        if (dna == null || dna.isNull()) return d;
        d.setCategory(dna.path("category").asText(null));
        d.setType(dna.path("type").asText(null));
        d.setMaterial(dna.path("material").asText(null));
        d.setGrade(dna.path("grade").asText(null));
        d.setDiameter(dna.path("diameter").asText(null));
        d.setLength(dna.path("length").asText(null));
        d.setSize(dna.path("size").asText(null));
        d.setPressureRating(dna.path("pressure_rating").asText(null));
        d.setVoltage(dna.path("voltage").asText(null));
        d.setCapacity(dna.path("capacity").asText(null));
        d.setStandard(dna.path("standard").asText(null));
        d.setUom(dna.path("uom").asText(null));
        try {
            d.setAttributesJson(mapper.writeValueAsString(dna));
        } catch (Exception ignored) {}
        return d;
    }

    private String dnaGrade(JsonNode dna) {
        if (dna == null || dna.isNull()) return "";
        return dna.path("grade").asText("").trim();
    }

    private DataQualityIssue issue(Long sourceMaterialId, String type, QualitySeverity sev, String desc) {
        DataQualityIssue i = new DataQualityIssue();
        i.setSourceMaterialId(sourceMaterialId);
        i.setIssueType(type);
        i.setSeverity(sev);
        i.setDescription(desc);
        return i;
    }

    private String normalizeLocal(String desc) {
        if (desc == null) return "";
        return desc.toUpperCase().replaceAll("\\s+", " ").trim();
    }

    private String guessCategory(String desc) {
        String d = desc == null ? "" : desc.toUpperCase();
        if (d.matches(".*(BOLT|SCREW|NUT|WASHER|FASTENER|STUD).*")) return "FASTENER";
        if (d.matches(".*(VALVE).*")) return "VALVE";
        if (d.matches(".*(PUMP).*")) return "PUMP";
        if (d.matches(".*(BEARING).*")) return "BEARING";
        if (d.matches(".*(MOTOR).*")) return "MOTOR";
        if (d.matches(".*(GASKET|FLANGE|PIPE|TUBE).*")) return "PIPING";
        if (d.matches(".*(CABLE|WIRE|TRANSFORMER|SWITCH).*")) return "ELECTRICAL";
        if (d.matches(".*(STEEL|PLATE|BAR|SHEET).*")) return "STEEL";
        if (d.matches(".*(COMPRESSOR|PUMP).*")) return "MACHINERY";
        return "GENERAL";
    }

    private ImportJobResponse mapJob(ImportJob j) {
        return new ImportJobResponse(j.getId(), j.getFileName(), j.getSourceOrganization(), j.getSourceType(),
                j.getSourceDocument(), j.getSourceUrl(), j.getStatus(), j.getTotalRecords(), j.getValidRecords(),
                j.getInvalidRecords(), j.getImportedRecords(), j.getErrorMessage(), j.getCreatedAt());
    }
}
