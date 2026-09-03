package com.sih.materialidentity.service;

import com.sih.materialidentity.entity.AuditEvent;
import com.sih.materialidentity.repository.AuditEventRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuditService {

    private final AuditEventRepository auditRepo;

    public AuditService(AuditEventRepository auditRepo) {
        this.auditRepo = auditRepo;
    }

    public List<AuditEvent> getAll() {
        return auditRepo.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    public void record(String actor, String action, String entityType, Long entityId,
                       String before, String after, String reason) {
        AuditEvent e = new AuditEvent();
        e.setActor(actor);
        e.setAction(action);
        e.setEntityType(entityType);
        e.setEntityId(entityId);
        e.setBeforeState(before);
        e.setAfterState(after);
        e.setReason(reason);
        auditRepo.save(e);
    }
}
