package tech.kood.swaply.service;

import java.util.List;

public record UserData(
        Long id,

        // location
        double latitude,
        double longitude,
        int maxDistanceKm,

        // bio
        List<String> interests,
        List<String> preferredCategories,
        List<String> preferredConditions,
        double minValue,
        double maxValue,

        // weights from the bio
        int wCategory,
        int wValue,
        int wDistance,
        int wCondition,
        int wInterests,

        // their active item
        String itemCategory,
        String itemCondition,
        double itemValue
) {}