# ChainLicense: Decentralized Intellectual Property Protection & ML Forensics

A next-generation Web3 Intellectual Property (IP) registry with integrated **Machine Learning Plagiarism Detection** and **Adversarial Transformation Forensics**. Protect your digital assets, detect derivatives, issue fractional license shares, and enforce cryptographic version locking on Ethereum.

---

## 🏗️ Architecture Overview

```text
ip-protection-system/
│
├── contracts/
│   └── ip.sol                      # Ethereum Smart Contract (ERC721, ERC20 Fractional Shares, Dynamic Pricing)
│
├── frontend/                       # Modular React + Vite Frontend
│   ├── src/
│   │   ├── components/             # Reusable UI primitives & audit report card
│   │   │   ├── Navbar.jsx
│   │   │   ├── Toast.jsx
│   │   │   ├── BuyModal.jsx
│   │   │   ├── PlagiarismReport.jsx # ML Plagiarism & Transformation report card
│   │   │   └── UIPrimitives.jsx
│   │   ├── pages/                  # Modular application views
│   │   │   ├── Marketplace.jsx     # Browse and purchase version-locked licenses
│   │   │   ├── Register.jsx        # Pre-registration ML audit & on-chain minting
│   │   │   ├── VerifyIP.jsx        # Dedicated IP Verification & Forensics tool
│   │   │   ├── MyLicenses.jsx      # License management & version matrix
│   │   │   ├── Shares.jsx          # Fractional ERC20 shares & revenue distribution
│   │   │   └── Pricing.jsx         # Dynamic bonding curve discovery
│   │   ├── services/
│   │   │   ├── mlService.js        # Client API for ML Forensics & Corpus Sync
│   │   │   ├── contract.js         # Web3 provider and ABI bindings
│   │   │   └── ipfs.js             # Pinata IPFS integration
│   │   ├── App.jsx                 # Application entry router
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── ml-service/                     # Python ML Microservice (FastAPI)
│   ├── main.py                     # API endpoints (/verify, /check/text, /check/image, /corpus)
│   ├── similarity.py               # Text (TF-IDF, n-gram, cosine) & Image (pHash, dHash, aHash, histograms)
│   ├── transformation.py           # Evasion forensics (rotation, flip, crop, blur, paraphrase)
│   ├── requirements.txt            # Python dependencies
│   └── models/                     # Persistent corpus database & vector storage
│       └── corpus_db.json
│
├── backend/                        # Node.js / Express API Gateway & Orchestrator
│   ├── server.js                   # Express server coordinating Frontend, ML Service, and IPFS
│   ├── package.json
│   └── .env.example
│
├── README.md                       # Documentation & API specifications
└── .gitignore                      # Git ignore rules for Python, Node, Vite, and secrets
```

---

## 🌟 Key Innovations

### 1. Machine Learning Forensics Engine (`ml-service/`)
- **Text Plagiarism Detection**:
  - Multi-granularity TF-IDF vectorization (word unigrams, bigrams, and character 4-grams).
  - Cosine similarity, Jaccard vocabulary overlap, and contiguous sequence alignment.
  - Sentence-level match extraction for pinpointing infringing paragraphs.
- **Image Perceptual Hashing**:
  - Triple-fingerprint perceptual hashing (`pHash` via 2D Discrete Cosine Transform, `dHash` gradient difference, and `aHash` luminance mean).
  - 3D HSV/RGB color histogram intersection analysis.
- **Transformation & Evasion Forensics**:
  - Detects attempts to circumvent copyright by rotating images (90°, 180°, 270°), horizontal/vertical mirroring, center cropping (80%, 65%), and Gaussian blurring.
  - Detects text paraphrasing, syntactic sentence shuffling, and homoglyph obfuscation.
- **Persistent Corpus Indexing**:
  - Automatically fingerprints and indexes all newly minted on-chain IP assets into `models/corpus_db.json`.

### 2. On-Chain Smart Contract (`contracts/ip.sol`)
- **ERC721 IP Asset Minting**: Every registered work is minted as a verifiable NFT on Ethereum.
- **Fractional Ownership (`LicenseShareToken`)**: Each property deploys a dedicated ERC20 token with 1,000 fractional shares, enabling co-ownership and automated royalty payouts.
- **Dynamic Bonding Curve Pricing**: License fees automatically scale according to demand:
  $$\text{Price} = \text{Base} + \text{Increment} \times \left(\min\left(\left\lfloor \frac{\text{LicensesSold}}{10} \right\rfloor + 1, 10\right) - 1\right)$$
- **Strict Version Locking**: A license purchased for Version $V$ grants access *only* to Version $V$. When creators publish an upgraded version, access to new iterations requires an upgraded license.

### 3. Integrated Verification & Marketplace (`frontend/`)
- **Pre-Mint ML Audit**: When uploading a file to register, the system runs an automatic plagiarism and derivative transformation check. If similarity exceeds threshold (70%+), an alert warns or prevents minting infringing copies.
- **IP Forensics Workbench**: Dedicated page for creators and rights holders to test any document, PDF, or image against the registered corpus.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ and npm
- Python 3.9+
- MetaMask browser extension

---

### 1. Smart Contract Deployment
1. Open [Remix IDE](https://remix.ethereum.org).
2. Create `ip.sol` and paste the contents from `contracts/ip.sol`.
3. In compiler tab, select Solidity `0.8.20` or higher and compile.
4. Deploy `IPRegistry` to your network (Sepolia, Hardhat, or Local Anvil/Ganache).
5. Copy the deployed contract address and update `frontend/src/contract.js`:
   ```javascript
   export const contractAddress = "0xYourDeployedContractAddress";
   ```

---

### 2. ML Service Setup
1. Navigate to `ml-service/`:
   ```bash
   cd ml-service
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # macOS/Linux
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the ML service:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The service will be live at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

---

### 3. Backend Gateway Setup
1. Navigate to `backend/`:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Start the backend:
   ```bash
   npm start
   ```
   Backend will run on `http://localhost:5000`.

---

### 4. Frontend Setup
1. Navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` in `frontend/` with your Pinata IPFS credentials:
   ```env
   VITE_PINATA_JWT=your_pinata_jwt_here
   VITE_BACKEND_URL=http://localhost:5000
   VITE_ML_SERVICE_URL=http://localhost:8000
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173` in your browser.

---

## 📡 ML Service API Reference

### 1. Unified Verification Endpoint
`POST /verify`
Accepts `file` (multipart/form-data) or `raw_text` (form field).
```bash
curl -X POST http://localhost:8000/verify \
  -F "file=@sample_paper.pdf"
```
**Sample Response:**
```json
{
  "type": "text",
  "similarity_score": 0.842,
  "percentage": 84.2,
  "risk_level": "HIGH",
  "status": "PLAGIARISM_DETECTED",
  "verdict": "High similarity detected! This content appears to infringe on an existing registered IP.",
  "best_match": {
    "id": 0,
    "title": "Decentralized Autonomous Intellectual Property Protocol",
    "cid": "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    "score": 0.842
  },
  "transformation_analysis": {
    "is_transformed": true,
    "detected_transformations": [
      {
        "type": "SYNTACTIC_REORDERING_PARAPHRASE",
        "confidence": 0.88,
        "evidence": "Vocabulary cosine is 88% but word sequence alignment is only 42%."
      }
    ]
  }
}
```

### 2. Image Forensic Analysis
`POST /check/image`
Detects rotation, cropping, flipping, blur, and color changes.
```bash
curl -X POST http://localhost:8000/check/image \
  -F "file=@altered_logo.png"
```

### 3. Register IP into ML Corpus
`POST /corpus/register`
```bash
curl -X POST http://localhost:8000/corpus/register \
  -F "id=2" \
  -F "title=Novel Cryptographic Protocol" \
  -F "cid=QmZtmD2qt8fJpq3CLDHtaogZbaY4nd6aebPxZNJkLkN2R5" \
  -F "file=@protocol.pdf"
```

---

## 📜 License
MIT License. Created for decentralized creators and intellectual property innovators.
