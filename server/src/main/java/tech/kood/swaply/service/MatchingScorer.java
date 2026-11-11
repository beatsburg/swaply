package tech.kood.swaply.service;

import java.util.List;

public class MatchingScorer {

    // Is this value on the wish list?
    // An empty or missing list means "open to anything".
    public static boolean wants(List<String> preferences, String value) {
        if (preferences == null || preferences.isEmpty()) {
            return true;
        }
        return preferences.contains(value);
    }

    // Turns two yes/no answers into a score.
    // Both yes = 1.0, one yes = 0.5, none = 0.0
    public static double pairScore(boolean a, boolean b) {
        if (a && b) {
            return 1.0;
        }
        if (a || b) {
            return 0.5;
        }
        return 0.0;
    }

    // Is the value between min and max? Edges count as inside.
    public static boolean inRange(double value, double min, double max) {
        return value >= min && value <= max;
    }

    // Interest score: how many hobbies both people share,
    // divided by the shorter list. Returns 0.0 to 1.0.
    public static double interestScore(List<String> mine, List<String> theirs) {
        // No interests on either side = nothing to compare
        if (mine == null || theirs == null || mine.isEmpty() || theirs.isEmpty()) {
            return 0.0;
        }

        // Counter for interests found in both lists
        int shared = 0;
        for (int i = 0; i < mine.size(); i++) {
            String interest = mine.get(i);
            if (theirs.contains(interest)) {
                shared = shared + 1;
            }
        }

        // The most that could match is the size of the shorter list
        int shorter = Math.min(mine.size(), theirs.size());

        // (double) keeps the decimals, so 1 / 2 gives 0.5, not 0
        return (double) shared / shorter;
    }

    // Distance in km between two GPS points (Haversine formula)
    public static double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double earthRadiusKm = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
    }

    // Closer = higher score. Uses the smaller of the two radiuses.
    // Never goes below 0.
    public static double distanceScore(double distance, int myRadius, int theirRadius) {
        int smaller = Math.min(myRadius, theirRadius);
        double score = 1.0 - distance / smaller;
        return Math.max(0.0, score);
    }

    // The mixer: combines five scores using the user's weights.
    // Returns a final score between 0.0 and 1.0.
    public static double mixer(
            double category, double value, double distance, double condition, double interests,
            int wCategory, int wValue, int wDistance, int wCondition, int wInterests) {
        int weightSum = wCategory + wValue + wDistance + wCondition + wInterests;
        if (weightSum == 0) {
            return 0.0;
        }
        double total = (category * wCategory + value * wValue + distance * wDistance
                + condition * wCondition + interests * wInterests) / weightSum;
        return total;
    }

    public static double scorePair(UserData me, UserData them) {
        // 1. distance gate
        double km = distanceKm(me.latitude(), me.longitude(), them.latitude(), them.longitude());
        if (km > me.maxDistanceKm() || km > them.maxDistanceKm()) {
            return 0.0;
        }

        // 2. category gate
        boolean iWantTheirs = wants(me.preferredCategories(), them.itemCategory());
        boolean theyWantMine = wants(them.preferredCategories(), me.itemCategory());
        if (!iWantTheirs && !theyWantMine) {
            return 0.0;
        }

        // 3. five channels
        double category = pairScore(iWantTheirs, theyWantMine);

        double value = pairScore(
                inRange(them.itemValue(), me.minValue(), me.maxValue()),
                inRange(me.itemValue(), them.minValue(), them.maxValue()));

        double condition = pairScore(
                wants(me.preferredConditions(), them.itemCondition()),
                wants(them.preferredConditions(), me.itemCondition()));

        double distance = distanceScore(km, me.maxDistanceKm(), them.maxDistanceKm());

        double interests = interestScore(me.interests(), them.interests());

        // 4. mix with MY weights
        return mixer(category, value, distance, condition, interests,
                me.wCategory(), me.wValue(), me.wDistance(), me.wCondition(), me.wInterests());
    }
}
