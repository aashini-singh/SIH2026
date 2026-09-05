import { useState } from "react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import SafetyReports from "./pages/SafetyReports";
import Overview from "./pages/Overview";
import SIFAnalysis from "./pages/SIFAnalysis";
import PrecursorIntelligence from "./pages/PrecursorIntelligence";
import HSEPriorities from "./pages/HSEPriorities";
import InterventionMonitoring from "./pages/InterventionMonitoring";
import type { UploadedAnalysis } from "./types";

const pageInfo: Record<
  string,
  {
    title: string;
    description: string;
  }
  > = {
  overview: {
    title: "Overview",
    description: "SIF potential & precursor intelligence",
  },

  reports: {
    title: "Safety Reports",
    description: "Review analyzed safety reports",
  },

  sif: {
    title: "SIF Analysis",
    description: "Serious Injury & Fatality potential analysis",
  },

  precursors: {
    title: "Precursor Intelligence",
    description: "Identify recurring SIF precursor patterns",
  },

  priorities: {
    title: "HSE Priorities",
    description: "Prioritize areas requiring HSE intervention",
  },

  interventions: {
    title: "Intervention Monitoring",
    description: "Monitor precursor patterns after intervention",
  },
};


function App() {

  const [activePage, setActivePage] =
    useState("overview");

  const [uploadedAnalysis, setUploadedAnalysis] =
    useState<UploadedAnalysis | null>(null);

  const current =
    pageInfo[activePage];


  const renderPage = () => {

  switch (activePage) {
    case "overview":
      return (
        <Overview
          uploadedAnalysis={uploadedAnalysis}
          onAnalysisComplete={setUploadedAnalysis}
        />
      );

    case "reports":
      return (
        <SafetyReports
          uploadedAnalysis={uploadedAnalysis}
        />
      );

    case "sif":
      return (
        <SIFAnalysis
          uploadedAnalysis={uploadedAnalysis}
        />
      );

    case "precursors":
      return (
        <PrecursorIntelligence
          uploadedAnalysis={uploadedAnalysis}
        />
      );

    case "priorities":
      return (
        <HSEPriorities
          uploadedAnalysis={uploadedAnalysis}
        />
      );
    case "interventions":
      return (
        <InterventionMonitoring
          uploadedAnalysis={uploadedAnalysis}
        />
      );
    default:
      return (
        <div className="coming-soon">
          <h2>
            {current.title}
          </h2>

          <p>
            This module will be connected next.
          </p>
        </div>
      );
    }
  };


  return (
    <div className="app">

      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
      />


      <div className="main-area">

        <Header
          title={current.title}
          description={current.description}
        />


        <main>
          {renderPage()}
        </main>

      </div>

    </div>
  );
}


export default App;