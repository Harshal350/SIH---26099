package com.sih.materialidentity.repository;

import com.sih.materialidentity.entity.AppUser;
import com.sih.materialidentity.entity.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByUsername(String username);
    long countByRole(Role role);
}
