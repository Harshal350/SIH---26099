package com.sih.materialidentity.service;

import com.sih.materialidentity.dto.AuthResponse;
import com.sih.materialidentity.entity.AppUser;
import com.sih.materialidentity.entity.enums.Role;
import com.sih.materialidentity.repository.AppUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    private final AppUserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final com.sih.materialidentity.security.JwtUtil jwtUtil;

    public UserService(AppUserRepository userRepo, PasswordEncoder passwordEncoder,
                       com.sih.materialidentity.security.JwtUtil jwtUtil) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    public AuthResponse authenticate(String username, String password) {
        AppUser user = userRepo.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new RuntimeException("Invalid credentials");
        }
        if (!user.getEnabled()) throw new RuntimeException("Account disabled");
        String token = jwtUtil.generateToken(user.getUsername(), user.getRole().name());
        return new AuthResponse(token, user.getUsername(), user.getDisplayName(), user.getRole().name());
    }

    public AppUser createUser(String username, String password, String displayName, Role role) {
        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setDisplayName(displayName);
        user.setRole(role);
        return userRepo.save(user);
    }

    public List<AppUser> list() {
        return userRepo.findAll();
    }
}
