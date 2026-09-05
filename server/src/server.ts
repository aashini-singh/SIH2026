import express from "express";
import cors from "cors";
import axios from "axios";
import multer from "multer";
import FormData from "form-data";

const app = express();

const PORT = 5000;
const FASTAPI_URL = "http://127.0.0.1:8000";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const response = await axios.get(`${FASTAPI_URL}/health`);

    res.json({
      status: "Node/Express is running",
      fastapi: response.data,
    });
  } catch (error) {
    res.status(500).json({
      status: "Node/Express is running",
      fastapi: "Unavailable",
    });
  }
});

// HSE priorities
app.get("/api/interventions/priorities", async (req, res) => {
  try {
    const response = await axios.get(
      `${FASTAPI_URL}/interventions/priorities`
    );

    res.json(response.data);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to connect to FastAPI",
    });
  }
});

// Specific intervention
app.get("/api/interventions/:patternId", async (req, res) => {
  try {
    const { patternId } = req.params;

    const response = await axios.get(
      `${FASTAPI_URL}/interventions/${patternId}`
    );

    res.json(response.data);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to fetch intervention",
    });
  }
});

// Supporting reports
app.get("/api/interventions/:patternId/reports", async (req, res) => {
  try {
    const { patternId } = req.params;

    const response = await axios.get(
      `${FASTAPI_URL}/interventions/${patternId}/reports`
    );

    res.json(response.data);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to fetch supporting reports",
    });
  }
});

// Precursor patterns
app.get("/api/precursors", async (req, res) => {
  try {
    const response = await axios.get(
      `${FASTAPI_URL}/precursors`
    );

    res.json(response.data);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to fetch precursor patterns",
    });
  }
});

// Reports
app.get("/api/reports", async (req, res) => {
  try {
    const response = await axios.get(
      `${FASTAPI_URL}/reports`
    );

    res.json(response.data);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to fetch reports",
    });
  }
});

// Upload safety report
app.post(
  "/api/reports/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
        });
      }

      const allowedExtensions = [
        ".pdf",
        ".csv",
        ".xlsx",
        ".xls",
      ];

      const fileName = req.file.originalname;

      const extension =
        "." + fileName.split(".").pop()?.toLowerCase();

      if (!allowedExtensions.includes(extension)) {
        return res.status(400).json({
          error: "Unsupported file type",
          supported: ["PDF", "CSV", "XLSX", "XLS"],
        });
      }

      const form = new FormData();

      form.append("file", req.file.buffer, {
        filename: fileName,
        contentType: req.file.mimetype,
      });

      const response = await axios.post(
        `${FASTAPI_URL}/reports/upload`,
        form,
        {
          headers: {
            ...form.getHeaders(),
          },
          maxBodyLength: Infinity,
        }
      );

      res.json(response.data);

    } catch (error: any) {
      console.error(
        "Upload/AI service error:",
        error.response?.data || error.message
      );

      res.status(500).json({
        error: "Unable to analyze uploaded report",
        details:
          error.response?.data || "AI service unavailable",
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Node/Express server running on http://localhost:${PORT}`);
});