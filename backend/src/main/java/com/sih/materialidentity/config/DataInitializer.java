package com.sih.materialidentity.config;

import com.sih.materialidentity.entity.AppUser;
import com.sih.materialidentity.entity.enums.Role;
import com.sih.materialidentity.repository.AppUserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner initUsers(AppUserRepository userRepo, PasswordEncoder encoder) {
        return args -> {
            if (userRepo.findByUsername("admin").isEmpty()) {
                AppUser admin = new AppUser();
                admin.setUsername("admin");
                admin.setPasswordHash(encoder.encode("admin123"));
                admin.setDisplayName("System Administrator");
                admin.setEmail("admin@nmm.gov.in");
                admin.setRole(Role.ADMIN);
                userRepo.save(admin);
            }
            if (userRepo.findByUsername("steward").isEmpty()) {
                AppUser steward = new AppUser();
                steward.setUsername("steward");
                steward.setPasswordHash(encoder.encode("steward123"));
                steward.setDisplayName("Data Steward");
                steward.setRole(Role.DATA_STEWARD);
                userRepo.save(steward);
            }
        };
    }
}
