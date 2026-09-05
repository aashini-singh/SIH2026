import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Rectangle,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import KPICard from "../components/KPICard";
import PriorityBadge from "../components/PriorityBadge";

import reports from "../data/sif_classified_reports.json";
import patterns from "../data/precursor_patterns.json";
import priorities from "../data/hse_priorities.json";
import { useRef, useState } from "react";

import type {
  SafetyReport,
  PrecursorPattern,
  HSEPriorityItem,
  UploadedAnalysis,
} from "../types";


  const defaultSafetyReports =
    reports as SafetyReport[];

  const defaultPrecursorPatterns =
    patterns as PrecursorPattern[];

  const defaultHSEPriorities =
    priorities as HSEPriorityItem[];

    interface OverviewProps {
      uploadedAnalysis: UploadedAnalysis | null;
      onAnalysisComplete: (analysis: UploadedAnalysis) => void;
    }
  
export default function Overview({
  uploadedAnalysis,
  onAnalysisComplete,
}: OverviewProps) {

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
     const safetyReports =
    uploadedAnalysis?.reports ?? defaultSafetyReports;

    const precursorPatterns =
      uploadedAnalysis?.precursor_patterns ??
      defaultPrecursorPatterns;

    const hsePriorities =
      uploadedAnalysis?.hse_priorities ??
      defaultHSEPriorities;
    const allowedTypes = [
      ".pdf",
      ".csv",
      ".xlsx",
      ".xls",
    ];

const handleFile = (file: File) => {
  const extension =
    "." + file.name.split(".").pop()?.toLowerCase();

  if (!allowedTypes.includes(extension)) {
    alert("Please upload a PDF, CSV, XLSX or XLS file.");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert("File size must be less than 10 MB.");
    return;
  }

  setSelectedFile(file);
};

const handleDrop = (
  event: React.DragEvent<HTMLDivElement>
) => {
  event.preventDefault();
  setIsDragging(false);

  const file = event.dataTransfer.files?.[0];

  if (file) {
    handleFile(file);
  }
};


  const handleAnalyze = async () => {
    if (!selectedFile) return;

    try {
      setIsAnalyzing(true);

      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await fetch(
        "http://localhost:5000/api/reports/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          data?.detail?.message ||
          "Failed to analyze report"
        );
      }

      const normalizedReports: SafetyReport[] =
        data.reports.map((report: any) => ({
          ...report,

          sif_classification: {
            sif_level:
              report.sif_classification?.sif_level ??
              "LOW",

            score:
              report.sif_classification?.score ??
              report.sif_classification?.sif_score ??
              0,
          },
        }));

      const analysis: UploadedAnalysis = {
        upload_id: data.upload_id,
        filename: data.filename,
        file_type: data.file_type,
        analyzed_at: data.analyzed_at,
        report_count: data.report_count,

        reports: normalizedReports,
        precursor_patterns: data.precursor_patterns,
        hse_priorities: data.hse_priorities,
      };

      onAnalysisComplete(analysis);

      if (!response.ok) {
        throw new Error(
          data?.error ||
          data?.detail?.message ||
          "Failed to analyze report"
        );
      }

      console.log("Analysis completed:", data);

      console.log(
        "Reports:",
        data.reports
      );

      console.log(
        "Precursor Patterns:",
        data.precursor_patterns
      );

      console.log(
        "HSE Priorities:",
        data.hse_priorities
      );

      alert(
        `Analysis completed successfully!\n\n` +
        `Reports: ${data.report_count}\n` +
        `Precursor Patterns: ${data.precursor_count}\n` +
        `HSE Priorities: ${data.hse_priority_count}`
      );

      setShowUploadModal(false);
      setSelectedFile(null);

    } catch (error) {

      console.error(
        "Upload analysis failed:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Failed to analyze report"
      );

    } finally {

      setIsAnalyzing(false);

    }
  };



  const high =
    safetyReports.filter(
      (report) =>
        report.sif_classification.sif_level ===
        "HIGH"
    ).length;

  const medium =
    safetyReports.filter(
      (report) =>
        report.sif_classification.sif_level ===
        "MEDIUM"
    ).length;

  const low =
    safetyReports.filter(
      (report) =>
        report.sif_classification.sif_level ===
        "LOW"
    ).length;


  const critical =
    hsePriorities.filter(
      (item) =>
        item.priority === "CRITICAL"
    ).length;


  const topPriority =
    hsePriorities[0];


  const chartData = [
  {
    name: "HIGH",
    value: high,
    fill: "#E53935",
  },
  {
    name: "MEDIUM",
    value: medium,
    fill: "#F5B82E",
  },
  {
    name: "LOW",
    value: low,
    fill: "#3F7FE5",
  },
];


  return (
    <div className="page-content">
      {/* UPLOAD REPORT */}

    <section className="panel" style={{ marginBottom: "20px" }}>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >

        <div>
          <h2 style={{ marginBottom: "6px" }}>
            Analyze a Safety Report
          </h2>

          <p>
            Upload a PDF, CSV or Excel report to generate
            SIF, Life-Saving Rule, precursor and HSE insights.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowUploadModal(true)}
        >
          📄 Upload Safety Report
        </button>

      </div>

    </section>
      {/* KPI SECTION */}

      <section className="kpi-grid">

        <KPICard
          label="Safety Reports"
          value={safetyReports.length}
          description="Reports analyzed"
          icon="▤"
        />

        <KPICard
          label="HIGH SIF"
          value={high}
          description="Requires attention"
          icon="⚠"
        />

        <KPICard
          label="Precursor Patterns"
          value={precursorPatterns.length}
          description="Patterns detected"
          icon="⌕"
        />

        <KPICard
          label="Critical HSE"
          value={critical}
          description="Priority interventions"
          icon="◆"
        />

      </section>


      {/* MAIN INSIGHT ROW */}

      <section className="dashboard-grid">

        {/* SIF CHART */}

        <div className="panel">

          <div className="panel-header">

            <div>
              <h2>
                SIF Potential Distribution
              </h2>

              <p>
                Current classification across analyzed reports
              </p>
            </div>

          </div>


          <div className="chart-container">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={chartData}
                barCategoryGap="35%"
              >

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip />

                <Bar
        dataKey="value"
        radius={[8, 8, 0, 0]}
        shape={(props) => (
          <Rectangle
            {...props}
            fill={props.payload?.fill}
          />
        )}
      />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>


        {/* TOP PRIORITY */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <h2>
                Top HSE Priority
              </h2>

              <p>
                Highest-ranked precursor requiring attention
              </p>

            </div>

          </div>


          {topPriority && (

            <div className="priority-content">

              <PriorityBadge
                priority={
                  topPriority.priority
                }
              />


              <h3>
                {topPriority.activity}
              </h3>


              <p className="priority-hazard">
                {topPriority.hazard}
              </p>


              <div className="priority-metrics">

                <div>
                  <strong>
                    {topPriority.occurrence_count}
                  </strong>

                  <span>
                    Occurrences
                  </span>
                </div>

                <div>
                  <strong>
                    {topPriority.high_sif_count}
                  </strong>

                  <span>
                    HIGH SIF
                  </span>
                </div>

                <div>
                  <strong>
                    {topPriority.countries.length}
                  </strong>

                  <span>
                    Countries
                  </span>
                </div>

              </div>


              <div className="recommendation">

                <div className="recommendation-label">
                  HSE Recommendation
                </div>

                <p>
                  {topPriority.recommendation}
                </p>

              </div>


              <button className="primary-button">
                View Priority →
              </button>

            </div>

          )}

        </div>

      </section>


      {/* PRECURSOR TABLE */}

      <section className="panel">

        <div className="panel-header">

          <div>

            <h2>
              Emerging SIF Precursor Patterns
            </h2>

            <p>
              Recurring safety patterns identified across reports
            </p>

          </div>

          <button className="text-button">
            View all →
          </button>

        </div>


        <div className="table-wrapper">

          <table>

            <thead>

              <tr>

                <th>
                  Activity
                </th>

                <th>
                  Hazard
                </th>

                <th>
                  Life-Saving Rule
                </th>

                <th>
                  Occurrences
                </th>

                <th>
                  Countries
                </th>

                <th>
                  Priority
                </th>

              </tr>

            </thead>


            <tbody>

              {precursorPatterns
                .slice(0, 6)
                .map((pattern) => (

                  <tr
                    key={pattern.pattern_id}
                  >

                    <td className="strong-cell">
                      {pattern.activity}
                    </td>

                    <td>
                      {pattern.hazard}
                    </td>

                    <td>
                      {pattern.related_lsrs.join(
                        ", "
                      )}
                    </td>

                    <td>
                      {pattern.occurrence_count}
                    </td>

                    <td>
                      {pattern.countries.length}
                    </td>

                    <td>

                      <PriorityBadge
                        priority={
                          pattern.priority
                        }
                      />

                    </td>

                  </tr>

                ))}

            </tbody>

          </table>

        </div>

      </section>


      {/* INTERVENTION */}

      <section className="monitoring-banner">

        <div className="monitoring-icon">
          ↗
        </div>

        <div className="monitoring-text">

          <h3>
            Intervention Effectiveness Monitoring
          </h3>

          <p>
            Track recurring precursor patterns before
            and after HSE interventions.
          </p>

        </div>

        <button className="secondary-button">
          View Monitoring →
        </button>

      </section>
            {/* UPLOAD MODAL */}

 {/* ================= ANALYZE SAFETY REPORT ================= */}

{/* ================= ANALYZE SAFETY REPORT ================= */}

<section
  style={{
    width: "100%",
    background: "#fffdf8",
    border: "1px solid #f0d58a",
    borderRadius: "18px",
    padding: "20px",
    marginBottom: "20px",
    boxSizing: "border-box",
  }}
>
  {/* HEADER */}

  <div
    style={{
      marginBottom: "16px",
    }}
  >
    <h2
      style={{
        margin: 0,
        color: "#111827",
        fontSize: "17px",
        fontWeight: 700,
      }}
    >
      Analyze Safety Report
    </h2>

    <p
      style={{
        margin: "5px 0 0",
        color: "#64748b",
        fontSize: "12px",
      }}
    >
      Upload a safety report to identify SIF potential, precursor patterns
      and HSE priorities.
    </p>
  </div>

  {/* UPLOAD BOX */}

  <div
    onDragOver={(event) => {
      event.preventDefault();
      setIsDragging(true);
    }}
    onDragLeave={() => {
      setIsDragging(false);
    }}
    onDrop={handleDrop}
    style={{
      width: "100%",
      height: "102px",
      border: isDragging
        ? "2px solid #d99b00"
        : "1.5px dashed #e7c96b",
      borderRadius: "13px",
      background: isDragging ? "#fff8dc" : "#fffefb",
      display: "flex",
      alignItems: "center",
      overflow: "hidden",
      boxSizing: "border-box",
    }}
  >

    {/* LEFT */}

    <div
      onClick={() => fileInputRef.current?.click()}
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: "18px",
        padding: "0 24px",
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    >

      {/* ICON */}

      <div
        style={{
          width: "56px",
          height: "56px",
          minWidth: "56px",
          borderRadius: "50%",
          background: "#fff1c7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: "27px" }}>
          📄
        </span>
      </div>

      {/* TEXT */}

      <div>
        <h3
          style={{
            margin: 0,
            marginBottom: "4px",
            color: "#111827",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          Drag & drop your report here
        </h3>

        <p
          style={{
            margin: 0,
            marginBottom: "9px",
            color: "#64748b",
            fontSize: "11px",
          }}
        >
          or click to browse from your computer
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {["PDF", "CSV", "XLSX"].map((type) => (
            <span
              key={type}
              style={{
                padding: "3px 8px",
                borderRadius: "999px",
                background: "#f1f5f9",
                color: "#475569",
                fontSize: "9px",
                fontWeight: 700,
              }}
            >
              {type}
            </span>
          ))}

          <span
            style={{
              color: "#94a3b8",
              fontSize: "10px",
              marginLeft: "2px",
            }}
          >
            | Max 10 MB
          </span>
        </div>
      </div>
    </div>

    {/* DIVIDER */}

    <div
      style={{
        width: "1px",
        height: "58px",
        background: "#eadfbd",
      }}
    />

    {/* RIGHT */}

    <div
      style={{
        width: "285px",
        minWidth: "285px",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "0 18px",
        boxSizing: "border-box",
      }}
    >

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: "148px",
          height: "38px",
          border: "none",
          borderRadius: "10px",
          background: "#fbbf24",
          color: "#111827",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "7px",
        }}
      >
        <span style={{ fontSize: "16px" }}>
          ↥
        </span>

        Choose File
      </button>

              <button
                className="primary-button"
                disabled={!selectedFile}
                onClick={handleAnalyze}
                style={{
                  opacity: selectedFile ? 1 : 0.5,
                  cursor: selectedFile
                    ? "pointer"
                    : "not-allowed",
                }}
              >
                {isAnalyzing
                  ? "Analyzing..."
                  : "Analyze Report →"}
              </button>

    {/* HIDDEN INPUT */}

    <input
      ref={fileInputRef}
      type="file"
      accept=".pdf,.csv,.xlsx,.xls"
      style={{ display: "none" }}
      onChange={(event) => {
        const file = event.target.files?.[0];

        if (file) {
          handleFile(file);
        }
      }}
    />
  </div>

  {/* SELECTED FILE */}

  {selectedFile && (
    <div
      style={{
        marginTop: "10px",
        padding: "10px 13px",
        borderRadius: "9px",
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
        }}
      >
        <div
          style={{
            width: "26px",
            height: "26px",
            borderRadius: "50%",
            background: "#dcfce7",
            color: "#15803d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          ✓
        </div>

        <div>
          <div
            style={{
              color: "#166534",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {selectedFile.name}
          </div>

          <div
            style={{
              color: "#64748b",
              fontSize: "9px",
            }}
          >
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setSelectedFile(null);

          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
        style={{
          border: "none",
          background: "transparent",
          color: "#64748b",
          fontSize: "10px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Remove
      </button>
    </div>
  )}
</section>
</div>       
    
  );
}