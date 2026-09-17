import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x965B18FA15cB829e32b0dFb806E955320dC8DeC0";

// Smart contract connection to IPRegistry
let contractInstance = null;
const candidatePaths = [
  path.resolve(__dirname, "../contracts/IPRegistry.json"),
  path.resolve(__dirname, "contracts/IPRegistry.json"),
  path.resolve(process.cwd(), "contracts/IPRegistry.json"),
  path.resolve(process.cwd(), "../contracts/IPRegistry.json")
];
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    try {
      const artifact = JSON.parse(fs.readFileSync(p, "utf8"));
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      contractInstance = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, provider);
      console.log(`[Blockchain]: Connected to IPRegistry at ${CONTRACT_ADDRESS} via ${RPC_URL}`);
      break;
    } catch (e) {
      console.warn("[Blockchain Initialization Note]:", e.message);
    }
  }
}

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

// Register newly minted IP into ML Corpus with Blockchain Patent Gatekeeper
app.post("/api/corpus/register", upload.single("file"), async (req, res) => {
  try {
    const { id, title, cid, owner, text_content } = req.body;
    const contentHash = req.file ? ethers.keccak256(req.file.buffer) : (req.body.contentHash || null);

    // Blockchain Patent & Anti-Copying Gatekeeper:
    // If the image contentHash or CID is already patented on-chain,
    // prevent unauthorized or duplicate claims under different IDs/titles.
    if (contractInstance) {
      try {
        // 1. Content Hash Verification
        if (contentHash && contentHash !== ethers.ZeroHash) {
          const isHashReg = await contractInstance.isContentHashRegistered(contentHash);
          if (isHashReg) {
            try {
              const patent = await contractInstance.getPatentByHash(contentHash);
              const patentId = patent[0].toString();
              const patentOwner = patent[1];
              const blockNumber = patent[2].toString();
              const patentTitle = patent[5];

              // Block duplicate or fraudulent claims
              if (!owner || patentOwner.toLowerCase() !== owner.toLowerCase() || (id !== undefined && String(id) !== patentId)) {
                console.warn(`[Patent Gatekeeper] Blocked registration of patented image. Patented in Block #${blockNumber} by ${patentOwner}`);
                return res.status(403).json({
                  success: false,
                  error: `Patent Claim Blocked: This asset's image is already patented on the blockchain in Block #${blockNumber} under Property #${patentId} ("${patentTitle}") by ${patentOwner}. Duplicate claims with modified title or ID are prohibited.`
                });
              }
            } catch (err) {
              return res.status(403).json({
                success: false,
                error: "Patent Claim Blocked: Asset with this image content hash is already patented on-chain."
              });
            }
          }
        }

        // 2. CID Uniqueness Verification
        if (cid && cid.trim().length > 0) {
          const isCidReg = await contractInstance.isCidRegistered(cid);
          if (isCidReg) {
            try {
              const patent = await contractInstance.getPatentByCid(cid);
              const patentId = patent[0].toString();
              const patentOwner = patent[1];
              const blockNumber = patent[2].toString();
              const patentTitle = patent[5];

              if (!owner || patentOwner.toLowerCase() !== owner.toLowerCase() || (id !== undefined && String(id) !== patentId)) {
                console.warn(`[Patent Gatekeeper] Blocked registration of patented CID. Patented in Block #${blockNumber} by ${patentOwner}`);
                return res.status(403).json({
                  success: false,
                  error: `Patent Claim Blocked: This CID is already patented on the blockchain in Block #${blockNumber} under Property #${patentId} ("${patentTitle}") by ${patentOwner}. Duplicate claims with modified title or ID are prohibited.`
                });
              }
            } catch (err) {
              return res.status(403).json({
                success: false,
                error: "Patent Claim Blocked: Asset with this CID is already patented on-chain."
              });
            }
          }
        }
      } catch (chainErr) {
        // RPC lookup skipped if node not currently reachable; ML similarity checks will enforce
        console.warn("[Blockchain Gatekeeper Check Skipped]:", chainErr.message);
      }
    }

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

// Query On-Chain Patent by CID or Content Hash
app.get("/api/blockchain/patent/:identifier", async (req, res) => {
  if (!contractInstance) {
    return res.status(503).json({
      success: false,
      error: "Smart contract connection is not available"
    });
  }

  const { identifier } = req.params;
  try {
    if (identifier.startsWith("0x") && identifier.length === 66) {
      const isReg = await contractInstance.isContentHashRegistered(identifier);
      if (!isReg) {
        return res.status(404).json({ success: false, patented: false, message: "Asset hash not patented" });
      }
      const patent = await contractInstance.getPatentByHash(identifier);
      return res.json({
        success: true,
        patented: true,
        propertyId: patent[0].toString(),
        owner: patent[1],
        blockNumber: patent[2].toString(),
        timestamp: patent[3].toString(),
        cid: patent[4],
        title: patent[5]
      });
    } else {
      const isReg = await contractInstance.isCidRegistered(identifier);
      if (!isReg) {
        return res.status(404).json({ success: false, patented: false, message: "Asset CID not patented" });
      }
      const patent = await contractInstance.getPatentByCid(identifier);
      return res.json({
        success: true,
        patented: true,
        propertyId: patent[0].toString(),
        owner: patent[1],
        blockNumber: patent[2].toString(),
        timestamp: patent[3].toString(),
        contentHash: patent[4],
        title: patent[5]
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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
