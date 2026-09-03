package com.sih.materialidentity.controller;

import com.sih.materialidentity.dto.AuthRequest;
import com.sih.materialidentity.dto.AuthResponse;
import com.sih.materialidentity.service.UserService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody AuthRequest request) {
        return userService.authenticate(request.username(), request.password());
    }
}
