from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from datetime import datetime
import io
import json
import pandas as pd

from extractor import extract_safety_information
from normalizer import normalize_result
from validator import validate_result
from sif_classifier import classify_sif
from precursor_detector import detect_precursors
from hse_prioritizer import prioritize_hse
app = FastAPI(
    title="SIH 2026 Safety Intelligence API",
    version="1.0.0",
)


# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# FILE PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

HSE_FILE = BASE_DIR / "hse_priorities.json"
PRECURSOR_FILE = BASE_DIR / "precursor_patterns.json"
REPORTS_FILE = BASE_DIR / "sif_classified_reports.json"
ANALYZED_REPORTS_DIR = BASE_DIR / "analyzed_reports"


# --------------------------------------------------
# LOAD JSON
# --------------------------------------------------

def load_json(path: Path):

    if not path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"JSON file not found: {path}"
        )

    try:
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)

    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid JSON in {path.name}: {error}"
        )


# --------------------------------------------------
# HEALTH
# --------------------------------------------------

@app.get("/health")
def health():

    return {
        "status": "ok",
        "service": "SIH 2026 Safety Intelligence API"
    }


# --------------------------------------------------
# HSE PRIORITIES
# --------------------------------------------------

@app.get("/interventions/priorities")
def get_priorities():

    priorities = load_json(HSE_FILE)

    return {
        "count": len(priorities),
        "priorities": priorities
    }


# --------------------------------------------------
# SINGLE PRIORITY
# --------------------------------------------------

@app.get("/interventions/{pattern_id}")
def get_intervention(pattern_id: str):

    priorities = load_json(HSE_FILE)
    precursors = load_json(PRECURSOR_FILE)
    reports = load_json(REPORTS_FILE)

    print("Requested pattern:", pattern_id)

    # ------------------------------
    # Find priority
    # ------------------------------

    priority = next(
        (
            item
            for item in priorities
            if str(item.get("pattern_id", "")).strip().upper()
            == pattern_id.strip().upper()
        ),
        None
    )

    if priority is None:

        raise HTTPException(
            status_code=404,
            detail={
                "message": "HSE priority not found",
                "requested_pattern": pattern_id,
                "available_patterns": [
                    item.get("pattern_id")
                    for item in priorities
                ]
            }
        )

    # ------------------------------
    # Find precursor
    # ------------------------------

    precursor = next(
        (
            item
            for item in precursors
            if str(item.get("pattern_id", "")).strip().upper()
            == pattern_id.strip().upper()
        ),
        None
    )

    # ------------------------------
    # Get report IDs
    # ------------------------------

    report_ids = set(
        priority.get("report_ids", [])
    )

    # ------------------------------
    # Find actual reports
    # ------------------------------

    related_reports = [
        report
        for report in reports
        if report.get("report_id") in report_ids
    ]

    return {
        "pattern_id": pattern_id,
        "hse_priority": priority,
        "precursor": precursor,
        "related_reports": related_reports
    }


# --------------------------------------------------
# SUPPORTING REPORTS
# --------------------------------------------------

@app.get("/interventions/{pattern_id}/reports")
def get_reports_for_pattern(pattern_id: str):

    priorities = load_json(HSE_FILE)
    reports = load_json(REPORTS_FILE)

    priority = next(
        (
            item
            for item in priorities
            if str(item.get("pattern_id", "")).strip().upper()
            == pattern_id.strip().upper()
        ),
        None
    )

    if priority is None:

        raise HTTPException(
            status_code=404,
            detail=f"Pattern {pattern_id} not found"
        )

    report_ids = set(
        priority.get("report_ids", [])
    )

    related_reports = [
        report
        for report in reports
        if report.get("report_id") in report_ids
    ]

    return {
        "pattern_id": pattern_id,
        "count": len(related_reports),
        "reports": related_reports
    }


# --------------------------------------------------
# ALL PRECURSORS
# --------------------------------------------------

@app.get("/precursors")
def get_precursors():

    precursors = load_json(PRECURSOR_FILE)

    return {
        "count": len(precursors),
        "precursors": precursors
    }


# --------------------------------------------------
# ALL REPORTS
# --------------------------------------------------

@app.get("/reports")
def get_reports():

    reports = load_json(REPORTS_FILE)

    return {
        "count": len(reports),
        "reports": reports
    }

@app.post("/reports/upload")
async def upload_report(
    file: UploadFile = File(...)
):

    try:

        # ==================================================
        # FILE VALIDATION
        # ==================================================

        filename = file.filename or ""
        extension = Path(filename).suffix.lower()

        allowed_extensions = {
            ".pdf",
            ".csv",
            ".xlsx",
            ".xls",
        }

        if extension not in allowed_extensions:

            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Unsupported file type",
                    "supported": [
                        "PDF",
                        "CSV",
                        "XLSX",
                        "XLS"
                    ],
                },
            )

        content = await file.read()

        if not content:

            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty",
            )

        # ==================================================
        # 1. EXTRACT FILE CONTENT
        # ==================================================

        if extension == ".pdf":

            from pypdf import PdfReader

            pdf = PdfReader(
                io.BytesIO(content)
            )

            pages = []

            for page in pdf.pages:

                text = page.extract_text() or ""

                if text.strip():
                    pages.append(
                        text.strip()
                    )

            extracted_text = "\n\n".join(
                pages
            )

            if not extracted_text.strip():

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No readable text found in PDF. "
                        "Scanned/image-only PDFs are not "
                        "supported yet."
                    ),
                )

            raw_records = [
                {
                    "source": filename,
                    "text": extracted_text,
                }
            ]

        elif extension == ".csv":

            df = pd.read_csv(
                io.BytesIO(content)
            )

            if df.empty:

                raise HTTPException(
                    status_code=400,
                    detail="CSV file contains no rows.",
                )

            raw_records = (
                df.fillna("")
                .to_dict(
                    orient="records"
                )
            )

        else:

            engine = (
                "openpyxl"
                if extension == ".xlsx"
                else "xlrd"
            )

            excel_file = pd.ExcelFile(
                io.BytesIO(content),
                engine=engine,
            )

            raw_records = []

            for sheet_name in excel_file.sheet_names:

                df = pd.read_excel(
                    excel_file,
                    sheet_name=sheet_name,
                )

                if df.empty:
                    continue

                records = (
                    df.fillna("")
                    .to_dict(
                        orient="records"
                    )
                )

                for record in records:

                    record["_sheet"] = (
                        sheet_name
                    )

                raw_records.extend(
                    records
                )

            if not raw_records:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Excel file contains "
                        "no usable rows."
                    ),
                )

        # ==================================================
        # 2. CREATE UNIQUE UPLOAD ID
        # ==================================================

        upload_id = datetime.now().strftime(
            "%Y%m%d_%H%M%S_%f"
        )

        processed_reports = []

        # ==================================================
        # 3. PROCESS EACH RECORD
        # ==================================================

        for index, record in enumerate(
            raw_records,
            start=1
        ):

            # ----------------------------------------------
            # Convert record to text
            # ----------------------------------------------

            if isinstance(record, dict):

                if "text" in record:

                    original_text = str(
                        record["text"]
                    )

                else:

                    parts = []

                    for key, value in record.items():

                        if value is None:
                            continue

                        value = str(value).strip()

                        if not value:
                            continue

                        parts.append(
                            f"{key}: {value}"
                        )

                    original_text = "\n".join(
                        parts
                    )

            else:

                original_text = str(record)

            if not original_text.strip():
                continue

            report_id = (
                f"UPLOAD-{upload_id}-{index:03d}"
            )

            # ----------------------------------------------
            # EXISTING EXTRACTOR
            # ----------------------------------------------

            raw_extraction = (
                extract_safety_information(
                    original_text
                )
            )

            # ----------------------------------------------
            # EXISTING NORMALIZER
            # ----------------------------------------------

            normalized_extraction = (
                normalize_result(
                    raw_extraction
                )
            )

            # ----------------------------------------------
            # EXISTING VALIDATOR
            # ----------------------------------------------

            validation = validate_result(
                normalized_extraction
            )

            report = {

                "report_id":
                    report_id,

                "source_file":
                    filename,

                "source_type":
                    extension,

                "original_report":
                    original_text,

                "raw_extraction":
                    raw_extraction,

                "normalized_extraction":
                    normalized_extraction,

                "validation":
                    validation,

                "status":
                    (
                        "SUCCESS"
                        if validation["is_valid"]
                        else "REVIEW_REQUIRED"
                    )
            }

            # ----------------------------------------------
            # EXISTING SIF CLASSIFIER
            # ----------------------------------------------

            sif_classification = classify_sif(
                report
            )

            report[
                "sif_classification"
            ] = sif_classification

            processed_reports.append(
                report
            )

        if not processed_reports:

            raise HTTPException(
                status_code=400,
                detail=(
                    "No usable safety reports "
                    "were found in the uploaded file."
                ),
            )

        # ==================================================
        # 4. PRECURSOR DETECTION
        # ==================================================

        precursor_patterns = (
            detect_precursors(
                processed_reports
            )
        )

        # ==================================================
        # 5. HSE PRIORITIZATION
        # ==================================================

        hse_priorities = (
            prioritize_hse(
                precursor_patterns
            )
        )

        # ==================================================
        # 6. BUILD FINAL ANALYZED JSON
        # ==================================================

        analyzed_result = {

            "upload_id":
                upload_id,

            "filename":
                filename,

            "file_type":
                extension,

            "analyzed_at":
                datetime.now().isoformat(),

            "report_count":
                len(processed_reports),

            "reports":
                processed_reports,

            "precursor_patterns":
                precursor_patterns,

            "hse_priorities":
                hse_priorities
        }

        # ==================================================
        # 7. SAVE ANALYZED REPORT
        # ==================================================

        ANALYZED_REPORTS_DIR.mkdir(
            parents=True,
            exist_ok=True
        )

        output_file = (
            ANALYZED_REPORTS_DIR
            / f"analysis_{upload_id}.json"
        )

        with open(
            output_file,
            "w",
            encoding="utf-8"
        ) as f:

            json.dump(
                analyzed_result,
                f,
                indent=2,
                ensure_ascii=False
            )

        # ==================================================
        # 8. RETURN ANALYZED RESULT
        # ==================================================

        return {

            "status":
                "analyzed",

            "upload_id":
                upload_id,

            "filename":
                filename,

            "file_type":
                extension,

            "report_count":
                len(processed_reports),

            "precursor_count":
                len(precursor_patterns),

            "hse_priority_count":
                len(hse_priorities),

            "saved_file":
                output_file.name,

            "reports":
                processed_reports,

            "precursor_patterns":
                precursor_patterns,

            "hse_priorities":
                hse_priorities
        }

    except HTTPException:
        raise

    except Exception as error:

        print(
            "Upload analysis error:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail={
                "message":
                    "Failed to analyze uploaded file",

                "error":
                    str(error)
            }
        )