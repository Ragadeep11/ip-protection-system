import { useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { Button, Typography, TextField } from "@mui/material";
import { contractAddress, contractABI } from "./contract";

/* -------------------------------
   Simple Image dHash (Perceptual)
--------------------------------*/
const generateImageHash = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 9;
            canvas.height = 8;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, 9, 8);
            const data = ctx.getImageData(0, 0, 9, 8).data;

            let bits = "";
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    const i = (y * 9 + x) * 4;
                    const j = (y * 9 + x + 1) * 4;
                    const left = data[i];
                    const right = data[j];
                    bits += left > right ? "1" : "0";
                }
            }
            resolve(bits);
        };
        img.src = URL.createObjectURL(file);
    });
};

const hammingDistance = (a, b) => {
    let dist = 0;
    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i]) dist++;
    return dist;
};

const imageHashes = [];
const textCorpus = [];

/* -------------------------------
   Basic Text Similarity
--------------------------------*/
const checkTextSimilarity = (text) => {
    const words = text.split(/\W+/);
    let maxSimilarity = 0;

    textCorpus.forEach(oldText => {
        const oldWords = oldText.split(/\W+/);
        const intersection = words.filter(w => oldWords.includes(w));
        const similarity = intersection.length / words.length;
        maxSimilarity = Math.max(maxSimilarity, similarity);
    });

    return maxSimilarity;
};

/* -------------------------------
   IPFS Upload
--------------------------------*/
const uploadToIPFS = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
            headers: {
                Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`
            }
        }
    );

    return res.data.IpfsHash;
};

function App() {

    const [file, setFile] = useState(null);
    const [propertyId, setPropertyId] = useState("");
    const [licenseAddress, setLicenseAddress] = useState("");
    const [result, setResult] = useState("");

    const getContract = async () => {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        return new ethers.Contract(contractAddress, contractABI, signer);
    };

    /* -------------------------------
       REGISTER PROPERTY
    --------------------------------*/
    const register = async () => {
        if (!file) return alert("Select file");

        // ---- Image plagiarism ----
        if (file.type.startsWith("image/")) {
            const hash = await generateImageHash(file);
            for (const oldHash of imageHashes) {
                if (hammingDistance(hash, oldHash) <= 10) {
                    return alert("Similar image detected!");
                }
            }
            imageHashes.push(hash);
        }

        // ---- Text plagiarism ----
        if (file.type === "text/plain") {
            const text = await file.text();
            const similarity = checkTextSimilarity(text);
            if (similarity > 0.7) {
                return alert("Text plagiarism detected!");
            }
            textCorpus.push(text);
        }

        const cid = await uploadToIPFS(file);
        const contract = await getContract();

        const start = performance.now();
        const tx = await contract.registerProperty(cid);
        const receipt = await tx.wait();
        const end = performance.now();

        console.log("Gas Used:", receipt.gasUsed.toString());
        console.log("Latency (ms):", end - start);

        const count = await contract.propertyCounter();
        const newId = Number(count) - 1;

        setPropertyId(newId);
        alert("Registered ID: " + newId);
    };

    /* -------------------------------
       UPDATE PROPERTY
    --------------------------------*/
    const update = async () => {
        const cid = await uploadToIPFS(file);
        const contract = await getContract();
        const tx = await contract.updateProperty(propertyId, cid);
        await tx.wait();
        console.log(contract.getCurrentVersion(0))
        alert("Updated!");
    };

    /* -------------------------------
       GRANT LICENSE
    --------------------------------*/
    const grant = async () => {
        const contract = await getContract();
        const tx = await contract.grantLicense(
            propertyId,
            licenseAddress,
            86400
        );
        await tx.wait();
        alert("License granted!");
    };

    const checkLicense = async () => {
        const contract = await getContract();
        const valid = await contract.isLicenseValid(
            propertyId,
            licenseAddress
        );
        setResult(valid ? "VALID" : "INVALID");
    };

    return (
        <div style={{ padding: 40 }}>
            <Typography variant="h4">IP Lifecycle System</Typography>

            <input type="file" onChange={e => setFile(e.target.files[0])} />
            <br /><br />

            <Button variant="contained" onClick={register}>
                Register
            </Button>

            <br /><br />

            <TextField
                label="Property ID"
                value={propertyId}
                onChange={e => setPropertyId(e.target.value)}
            />

            <br /><br />

            <Button variant="contained" onClick={update}>
                Update
            </Button>

            <br /><br />

            <TextField
                label="License Address"
                value={licenseAddress}
                onChange={e => setLicenseAddress(e.target.value)}
            />

            <br /><br />

            <Button variant="contained" onClick={grant}>
                Grant License
            </Button>

            <br /><br />

            <Button variant="outlined" onClick={checkLicense}>
                Check License
            </Button>

            <br /><br />

            <Typography variant="h6">
                {result}
            </Typography>
        </div>
    );
}

export default App;