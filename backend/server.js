import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

// Memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

app.use(cors());
app.use(express.json());

// Health Check
app.get("/api/health", async (req, res) => {
  let mlStatus = "offline";
  try {
    const mlRes = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 2000 });
    mlStatus = mlRes.data.status || "online";
  } catch (err) {
    mlStatus = "offline";
  }

  res.json({
    status: "online",
    backend: "IP Protection Gateway",
    ml_service: mlStatus,
    timestamp: new Date().toISOString()
  });
});

// Verify File or Text for Plagiarism & Transformations
app.post("/api/verify", upload.single("file"), async (req, res) => {
  try {
    if (req.file) {
      const form = new FormData();
      form.append("file", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });

      const mlResponse = await axios.post(`${ML_SERVICE_URL}/verify`, form, {
        headers: form.getHeaders(),
        timeout: 25000
      });

      const result = mlResponse.data;
      // Evaluate registration eligibility (e.g. Reject if similarity >= 70%)
      const canRegister = result.risk_level !== "HIGH";

      return res.json({
        success: true,
        can_register: canRegister,
        data: result
      });
    } else if (req.body.text) {
      const mlResponse = await axios.post(
        `${ML_SERVICE_URL}/check/text`,
        { text: req.body.text },
        { timeout: 15000 }
      );

      const result = mlResponse.data;
      const canRegister = result.risk_level !== "HIGH";

      return res.json({
        success: true,
        can_register: canRegister,
        data: result
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "No file or text provided for verification"
      });
    }
  } catch (error) {
    console.error("[Backend Verify Error]:", error.message);
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data?.detail || "ML Service Error"
      });
    }
    return res.status(502).json({
      success: false,
      error: "ML Service is currently unavailable. Please verify that ml-service is running on port 8000."
    });
  }
});

// Register newly minted IP into ML Corpus
app.post("/api/corpus/register", upload.single("file"), async (req, res) => {
  try {
    const { id, title, cid, owner, text_content } = req.body;

    const form = new FormData();
    form.append("id", id || 0);
    form.append("title", title || `Property #${id}`);
    form.append("cid", cid || "");
    form.append("owner", owner || "");

    if (req.file) {
      form.append("file", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
    } else if (text_content) {
      form.append("text_content", text_content);
    }

    const mlResponse = await axios.post(`${ML_SERVICE_URL}/corpus/register`, form, {
      headers: form.getHeaders(),
      timeout: 20000
    });

    res.json({
      success: true,
      data: mlResponse.data
    });
  } catch (error) {
    console.error("[Backend Corpus Register Error]:", error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: error.response?.data?.detail || error.message
    });
  }
});

// List all indexed assets in ML Corpus
app.get("/api/corpus", async (req, res) => {
  try {
    const mlResponse = await axios.get(`${ML_SERVICE_URL}/corpus`, { timeout: 5000 });
    res.json({
      success: true,
      data: mlResponse.data
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      error: "Could not retrieve corpus from ML service"
    });
  }
});

app.listen(PORT, () => {
  console.log(`[IP Protection Backend] Running on http://localhost:${PORT}`);
  console.log(`[IP Protection Backend] Proxying ML requests to ${ML_SERVICE_URL}`);
});
