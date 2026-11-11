package tech.kood.swaply.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;

@Service
public class SeedService {

    public static final String PASSWORD = "password123";

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;

    public SeedService(JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    // One fake user, before it goes into the database
    record SeedUser(String email, String name, String city, double lat, double lon,
                    List<String> interests, List<String> wantCategories, List<String> wantConditions,
                    int minValue, int maxValue, int radiusKm,
                    String itemTitle, String itemCategory, String itemCondition, int itemValue) {}

    // ---------- the "sample library": lists the random users are built from ----------

    static final List<String> FIRST_NAMES = List.of(
            "Mari", "Liis", "Kaur", "Tõnu", "Eva", "Peeter", "Anna", "Karl", "Kristi", "Mart",
            "Laura", "Siim", "Kadri", "Rasmus", "Grete", "Oliver", "Helen", "Markus", "Triin", "Martin");

    static final List<String> LAST_NAMES = List.of(
            "Tamm", "Saar", "Sepp", "Mägi", "Kask", "Kukk", "Rebane", "Ilves", "Pärn", "Koppel");

    static final List<String> INTERESTS = List.of(
            "music", "cycling", "gaming", "cooking", "hiking", "photography", "reading",
            "boardgames", "gardening", "film", "running", "art", "travel", "coding", "fishing");

    static final List<String> CONDITIONS = List.of("new", "like_new", "good", "fair");

    // category -> items people might offer
    static final Map<String, List<String>> ITEMS = Map.of(
            "technology", List.of("PlayStation 5", "Old iPad", "Bluetooth speaker", "Mechanical keyboard", "Film camera"),
            "sports",     List.of("Gravel bike", "Snowboard", "Tennis racket", "Running shoes", "Kettlebell set"),
            "music",      List.of("Acoustic guitar", "Bass amp", "MIDI keyboard", "Vinyl collection", "Guitar pedal"),
            "books",      List.of("Harry Potter set", "Cookbook bundle", "Estonian classics", "Comics box", "Design books"),
            "home",       List.of("Floor lamp", "Coffee machine", "Armchair", "Houseplants", "Wall mirror"),
            "tools",      List.of("Cordless drill", "Toolbox", "Sanding machine", "Ladder", "Workbench"),
            "games",      List.of("Catan", "Chess set", "LEGO box", "Puzzle collection", "Retro console"),
            "outdoor",    List.of("Tent", "Camping stove", "Hiking backpack", "Kayak paddle", "Sleeping bag"));

    static final List<String> CATEGORIES = List.of(
            "technology", "sports", "music", "books", "home", "tools", "games", "outdoor");

    // ---------- the main method ----------

    // Creates the demo users plus random ones. Returns how many were created.
    public int seed(int randomCount) {
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE email LIKE '%@swaply.test'", Integer.class);
        if (existing != null && existing > 0) {
            return 0;   // already seeded, run /dev/reset first
        }

        String hash = passwordEncoder.encode(PASSWORD);   // hash once, reuse for everyone

        List<SeedUser> users = new ArrayList<>(demoUsers());
        users.addAll(randomUsers(randomCount, new Random(42)));

        for (SeedUser u : users) {
            insert(u, hash);
        }
        return users.size();
    }

    // ---------- three fixed users, so the demo always has the same faces ----------

    static List<SeedUser> demoUsers() {
        return List.of(
                // Jan: Tallinn, offers a bike, wants tech or music
                new SeedUser("jan@swaply.test", "Jan Demo", "Tallinn", 59.437, 24.754,
                        List.of("cycling", "music", "coding"), List.of("technology", "music"), List.of("new", "like_new"),
                        50, 500, 30,
                        "Gravel bike", "sports", "like_new", 450),
                // Mari: 3 km away, offers a PS5, wants sports or games -> strong match for Jan
                new SeedUser("mari@swaply.test", "Mari Demo", "Tallinn", 59.420, 24.800,
                        List.of("music", "gaming"), List.of("sports", "games"), List.of("like_new", "good"),
                        30, 500, 20,
                        "PlayStation 5", "technology", "like_new", 400),
                // Liis: Tartu, 160 km away -> never recommended to Jan (distance gate)
                new SeedUser("liis@swaply.test", "Liis Demo", "Tartu", 58.378, 26.729,
                        List.of("music", "hiking"), List.of("sports"), List.of(),
                        0, 1000, 50,
                        "Acoustic guitar", "music", "good", 300));
    }

    // ---------- random users ----------

    static List<SeedUser> randomUsers(int count, Random random) {
        List<SeedUser> users = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            boolean tartu = random.nextInt(100) < 30;                 // ~30% Tartu, ~70% Tallinn
            String city = tartu ? "Tartu" : "Tallinn";
            double lat = (tartu ? 58.378 : 59.437) + (random.nextDouble() - 0.5) * 0.08;   // spread ~4 km
            double lon = (tartu ? 26.729 : 24.754) + (random.nextDouble() - 0.5) * 0.16;

            String name = pick(FIRST_NAMES, random) + " " + pick(LAST_NAMES, random);

            String itemCategory = pick(CATEGORIES, random);
            String itemTitle = pick(ITEMS.get(itemCategory), random);
            String itemCondition = pick(CONDITIONS, random);
            int itemValue = (2 + random.nextInt(59)) * 10;            // 20 .. 600 €

            int minValue = random.nextInt(11) * 10;                   // 0 .. 100 €
            int maxValue = minValue + (20 + random.nextInt(61)) * 10; // +200 .. +800 €
            int radiusKm = 10 + random.nextInt(71);                   // 10 .. 80 km

            users.add(new SeedUser(
                    "user" + i + "@swaply.test", name, city, lat, lon,
                    pickSome(INTERESTS, 2, 4, random),
                    pickSome(CATEGORIES, 1, 3, random),
                    random.nextInt(4) == 0 ? List.of() : pickSome(CONDITIONS, 1, 3, random),  // 1 in 4: open to any
                    minValue, maxValue, radiusKm,
                    itemTitle, itemCategory, itemCondition, itemValue));
        }
        return users;
    }

    // ---------- writing one user into the four tables ----------

    private void insert(SeedUser u, String hash) {
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id",
                Long.class, u.email(), hash);

        jdbcTemplate.update(
                "INSERT INTO profiles (user_id, name, about_me, city, latitude, longitude, is_completed) " +
                        "VALUES (?, ?, ?, ?, ?, ?, true)",
                id, u.name(), "Hi! I'm swapping my " + u.itemTitle().toLowerCase() + ".",
                u.city(), u.lat(), u.lon());

        String weights = "{\"category\": 3, \"value\": 2, \"distance\": 2, \"condition\": 2, \"interests\": 1}";
        jdbcTemplate.update(
                "INSERT INTO user_bios (user_id, interests, preferred_categories, preferred_conditions, " +
                        "min_value, max_value, max_distance_km, weights) " +
                        "VALUES (?, ?::text[], ?::text[], ?::text[], ?, ?, ?, ?::jsonb)",
                id, pgArray(u.interests()), pgArray(u.wantCategories()), pgArray(u.wantConditions()),
                u.minValue(), u.maxValue(), u.radiusKm(), weights);

        jdbcTemplate.update(
                "INSERT INTO items (user_id, title, description, category, condition, estimated_value, status) " +
                        "VALUES (?, ?, ?, ?, ?, ?, 'active')",
                id, u.itemTitle(), "Seed item", u.itemCategory(), u.itemCondition(), u.itemValue());
    }

    // ---------- small helpers ----------

    static String pick(List<String> list, Random random) {
        return list.get(random.nextInt(list.size()));
    }

    static List<String> pickSome(List<String> list, int min, int max, Random random) {
        List<String> copy = new ArrayList<>(list);
        Collections.shuffle(copy, random);
        int n = min + random.nextInt(max - min + 1);
        return copy.subList(0, n);
    }

    // Java list -> PostgreSQL array text, e.g. ["music", "hiking"] -> "{music,hiking}"
    static String pgArray(List<String> list) {
        return "{" + String.join(",", list) + "}";
    }
}