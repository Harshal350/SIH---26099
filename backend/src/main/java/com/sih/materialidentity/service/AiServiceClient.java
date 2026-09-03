package com.sih.materialidentity.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class AiServiceClient {

    private final String aiServiceUrl;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    public AiServiceClient(@Value("${ai.service.url:http://localhost:8000}") String aiServiceUrl) {
        this.aiServiceUrl = aiServiceUrl;
    }

    private JsonNode post(String path, ObjectNode body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(body.toString(), headers);
            ResponseEntity<String> resp = restTemplate.postForEntity(aiServiceUrl + path, entity, String.class);
            String json = resp.getBody();
            return json == null ? mapper.createObjectNode() : mapper.readTree(json);
        } catch (Exception e) {
            ObjectNode fallback = mapper.createObjectNode();
            fallback.put("error", e.getMessage() == null ? "AI service unreachable" : e.getMessage());
            return fallback;
        }
    }

    public boolean isAvailable() {
        try {
            restTemplate.getForEntity(aiServiceUrl + "/health", String.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public JsonNode analyzeDescription(String description) {
        ObjectNode body = mapper.createObjectNode();
        body.put("description", description);
        return post("/analyze", body);
    }

    public JsonNode compareMaterials(String descA, JsonNode dnaA, String descB, JsonNode dnaB) {
        ObjectNode body = mapper.createObjectNode();
        body.put("description_a", descA);
        body.set("dna_a", dnaA == null ? mapper.createObjectNode() : dnaA);
        body.put("description_b", descB);
        body.set("dna_b", dnaB == null ? mapper.createObjectNode() : dnaB);
        return post("/compare", body);
    }
}
