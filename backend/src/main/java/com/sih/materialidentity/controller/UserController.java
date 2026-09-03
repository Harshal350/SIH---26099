package com.sih.materialidentity.controller;

import com.sih.materialidentity.entity.AppUser;
import com.sih.materialidentity.entity.enums.Role;
import com.sih.materialidentity.service.UserService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public List<AppUser> list() {
        return userService.list();
    }

    @PostMapping
    public AppUser create(@RequestBody Map<String, String> body) {
        return userService.createUser(body.get("username"), body.get("password"),
                body.get("displayName"), Role.valueOf(body.get("role")));
    }
}
