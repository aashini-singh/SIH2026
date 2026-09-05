import json
import re
from collections import defaultdict


INPUT_FILE = "sif_classified_reports.json"
OUTPUT_FILE = "precursor_patterns.json"


def extract_field(text, field_name):

    if not text:
        return None

    pattern = rf"{re.escape(field_name)}\s*:\s*(.*)"

    match = re.search(
        pattern,
        text,
        re.IGNORECASE
    )

    if not match:
        return None

    value = match.group(1).strip()

    value = re.split(
        r"\s+(?:COUNTRY|FUNCTION|CAUSE|ACTIVITY|PRIMARY LIFE-SAVING RULE|"
        r"SECONARY LIFE-SAVING RULE|NARRATIVE|WHAT WENT WRONG|"
        r"CORRECTIVE ACTIONS|CAUSAL FACTORS)\s*:",
        value,
        flags=re.IGNORECASE
    )[0].strip()

    return value


def clean(value):

    if value is None:
        return None

    value = str(value).strip()

    if value.lower() in [
        "",
        "unknown",
        "null",
        "none",
        "not specified"
    ]:
        return None

    return value


def normalize_key(value):

    if not value:
        return "Unknown"

    return value.strip().lower()


def detect_precursors(reports):

    patterns = defaultdict(lambda: {
        "report_ids": [],
        "countries": [],
        "activities": [],
        "hazards": [],
        "lsrs": [],
        "barrier_failures": [],
        "sif_levels": [],
        "scores": []
    })

    for report in reports:

        extraction = report.get(
            "normalized_extraction",
            {}
        )

        sif = report.get(
            "sif_classification",
            {}
        )

        activity = clean(
            extraction.get("activity")
        )

        hazard = clean(
            extraction.get("hazard")
        )

        barrier = clean(
            extraction.get("barrier_failure")
        )

        primary_lsr = clean(
            extraction.get("primary_lsr")
        )

        secondary_lsr = clean(
            extraction.get("secondary_lsr")
        )

        original_text = (
            report.get("original_report")
            or ""
        )

        country = clean(
            extract_field(
                original_text,
                "COUNTRY"
            )
        )

        # -----------------------------------------
        # PRECURSOR KEY
        # -----------------------------------------

        activity_key = normalize_key(activity)
        hazard_key = normalize_key(hazard)
        barrier_key = normalize_key(barrier)

        key = (
            activity_key,
            hazard_key,
            barrier_key
        )

        # -----------------------------------------
        # STORE INFORMATION
        # -----------------------------------------

        patterns[key]["report_ids"].append(
            report.get("report_id")
        )

        if country:
            patterns[key]["countries"].append(country)

        if activity:
            patterns[key]["activities"].append(activity)

        if hazard:
            patterns[key]["hazards"].append(hazard)

        if primary_lsr:
            patterns[key]["lsrs"].append(primary_lsr)

        if secondary_lsr:
            patterns[key]["lsrs"].append(secondary_lsr)

        if barrier:
            patterns[key]["barrier_failures"].append(barrier)

        sif_level = sif.get("sif_level")

        if sif_level:
            patterns[key]["sif_levels"].append(
                sif_level
            )

        # IMPORTANT:
        # SIF classifier uses "sif_score"
        score = sif.get("sif_score")

        if isinstance(score, (int, float)):
            patterns[key]["scores"].append(score)

    # -----------------------------------------
    # BUILD RESULTS
    # -----------------------------------------

    precursor_results = []

    for index, (key, data) in enumerate(
        patterns.items(),
        start=1
    ):

        occurrence_count = len(
            data["report_ids"]
        )

        high_count = data["sif_levels"].count(
            "HIGH"
        )

        medium_count = data["sif_levels"].count(
            "MEDIUM"
        )

        low_count = data["sif_levels"].count(
            "LOW"
        )

        unique_countries = sorted(
            set(data["countries"])
        )

        unique_lsrs = sorted(
            set(data["lsrs"])
        )

        avg_score = (
            round(
                sum(data["scores"])
                / len(data["scores"]),
                2
            )
            if data["scores"]
            else 0
        )

        # -----------------------------------------
        # PRECURSOR PRIORITY SCORE
        # -----------------------------------------

        priority_score = (
            occurrence_count * 2
            + high_count * 3
            + medium_count
        )

        if len(unique_countries) >= 2:
            priority_score += 2

        if priority_score >= 12:
            priority = "HIGH"

        elif priority_score >= 6:
            priority = "MEDIUM"

        else:
            priority = "LOW"

        activity_display = (
            data["activities"][0]
            if data["activities"]
            else "Unknown activity"
        )

        hazard_display = (
            data["hazards"][0]
            if data["hazards"]
            else "Unknown hazard"
        )

        barrier_display = (
            data["barrier_failures"][0]
            if data["barrier_failures"]
            else "Unknown barrier failure"
        )

        precursor_results.append({

            "pattern_id":
                f"PREC-{index:03d}",

            "activity":
                activity_display,

            "hazard":
                hazard_display,

            "barrier_failure":
                barrier_display,

            "related_lsrs":
                unique_lsrs,

            "countries":
                unique_countries,

            "occurrence_count":
                occurrence_count,

            "high_sif_count":
                high_count,

            "medium_sif_count":
                medium_count,

            "low_sif_count":
                low_count,

            "average_sif_score":
                avg_score,

            "priority_score":
                priority_score,

            "priority":
                priority,

            "report_ids":
                data["report_ids"]
        })

    # -----------------------------------------
    # SORT
    # -----------------------------------------

    precursor_results.sort(
        key=lambda x: (
            x["priority_score"],
            x["occurrence_count"],
            x["high_sif_count"]
        ),
        reverse=True
    )

    for rank, pattern in enumerate(
        precursor_results,
        start=1
    ):
        pattern["rank"] = rank

    return precursor_results


def main():

    with open(
        INPUT_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        reports = json.load(f)

    precursor_results = detect_precursors(
        reports
    )

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            precursor_results,
            f,
            indent=2,
            ensure_ascii=False
        )

    print("\n" + "=" * 60)
    print("PRECURSOR PATTERN DETECTION COMPLETED")
    print("=" * 60)

    print(
        f"Reports processed : {len(reports)}"
    )

    print(
        f"Patterns detected : {len(precursor_results)}"
    )

    print(
        f"\nOutput saved to: {OUTPUT_FILE}"
    )


if __name__ == "__main__":
    main()