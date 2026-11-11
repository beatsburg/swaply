package tech.kood.swaply.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.kood.swaply.service.SeedService;

import java.util.Map;

@RestController
public class SeedController {

    private final SeedService seedService;

    public SeedController(SeedService seedService) {
        this.seedService = seedService;
    }

    // Loads test users. Run POST /dev/reset first to start from an empty database.
    @PostMapping({"/dev/seed", "/api/dev/seed"})
    public Map<String, Object> seed() {
        int created = seedService.seed(120);
        if (created == 0) {
            return Map.of("message", "Already seeded. Run POST /dev/reset first.", "created", 0);
        }
        return Map.of("message", "Seed complete", "created", created, "password", SeedService.PASSWORD);
    }
}