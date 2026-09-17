import React, { useState } from "react";
import { css, Field, Spinner, MAX_FILE_MB, short } from "../components/UIPrimitives";
import { PlagiarismReport } from "../components/PlagiarismReport";
import { verifyIPAsset, syncAssetToMLCorpus } from "../services/mlService";
import { getContract, getAddress } from "../contract";
import axios from "axios";
import { ethers } from "ethers";

export function Register({ onRegistered, showToast }) {
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState("");
    const [pct, setPct] = useState(null);
    const [busy, setBusy] = useState(false);
    const [auditing, setAuditing] = useState(false);
    const [auditReport, setAuditReport] = useState(null);
    const [result, setResult] = useState(null);

    const onFileChange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > MAX_FILE_MB * 1024 * 1024) {
            alert(`File too large. Maximum ${MAX_FILE_MB}MB.`);
            return;
        }
        setFile(f);
        setAuditReport(null);
        setResult(null);

        // Auto-run ML audit on file selection
        runMLAudit(f);
    };

    const runMLAudit = async (f) => {
        const target = f || file;
        if (!target) return;
        setAuditing(true);
        try {
            const report = await verifyIPAsset(target);
            setAuditReport(report);
        } catch (err) {
            console.error(err);
        } finally {
            setAuditing(false);
        }
    };

    const uploadToIPFS = async (f, onProgress) => {
        const formData = new FormData();
        formData.append("file", f);
        const jwt = import.meta.env.VITE_PINATA_JWT;
        if (!jwt) throw new Error("Missing VITE_PINATA_JWT environment variable");

        const res = await axios.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            formData,
            {
                headers: { Authorization: `Bearer ${jwt}` },
                timeout: 30000,
                onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total))
            }
        );
        if (!res.data?.IpfsHash) throw new Error("Pinata pinning failed.");
        return res.data.IpfsHash;
    };

    const computeFileHash = async (f) => {
        try {
            const buf = await f.arrayBuffer();
            const bytes = new Uint8Array(buf);
            return ethers.keccak256(bytes);
        } catch (e) {
            console.warn("Could not compute file hash:", e);
            return null;
        }
    };

    const register = async () => {
        if (!file) return alert("Please select a file first");

        if (auditing) {
            return alert("ML forensics audit is still running. Please wait for the analysis to complete.");
        }

        // STRICT ANTI-COPYING ENFORCEMENT: Reject any plagiarized or duplicate asset
        if (auditReport && (auditReport.risk_level === "HIGH" || auditReport.status === "INFRINGING_COPY" || auditReport.status === "PLAGIARISM_DETECTED")) {
            const matchedId = auditReport.best_match?.id !== undefined ? `Property #${auditReport.best_match.id}` : "an existing IP";
            const matchedTitle = auditReport.best_match?.title ? ` ("${auditReport.best_match.title}")` : "";
            alert(
                `⛔ REGISTRATION BLOCKED!\n\n` +
                `The ML forensics engine detected high similarity (${auditReport.percentage}%) matching ${matchedId}${matchedTitle}.\n\n` +
                `Under intellectual property rules, registering an identical, copied, or derivative work is strictly prohibited.`
            );
            return;
        }

        setBusy(true);
        setResult(null);
        try {
            // 1. Compute cryptographic hash of image/file content
            const contentHash = await computeFileHash(file);

            // 2. Pre-check on-chain registration state before spending gas or pinning
            const contract = await getContract();
            if (contentHash) {
                try {
                    const isHashRegistered = await contract.isContentHashRegistered(contentHash);
                    if (isHashRegistered) {
                        let existingId = "unknown";
                        try {
                            existingId = (await contract.contentHashToPropertyId(contentHash)).toString();
                        } catch (e) {}
                        throw new Error(
                            `Blockchain Anti-Copying Enforcement: This identical image/content is already registered on-chain as Property #${existingId}! Duplicate registration is strictly prohibited.`
                        );
                    }
                } catch (err) {
                    if (err.message.includes("Blockchain Anti-Copying")) throw err;
                }
            }

            // 3. Pin to IPFS
            setPct(0);
            const cid = await uploadToIPFS(file, (p) => setPct(p));
            setPct(null);

            // 4. Verify CID uniqueness on-chain
            try {
                const isCidReg = await contract.isCidRegistered(cid);
                if (isCidReg) {
                    let existingId = "unknown";
                    try {
                        existingId = (await contract.cidToPropertyId(cid)).toString();
                    } catch (e) {}
                    throw new Error(
                        `Blockchain Anti-Copying Enforcement: An asset with this identical image CID (${cid}) is already registered on-chain as Property #${existingId}!`
                    );
                }
            } catch (err) {
                if (err.message.includes("Blockchain Anti-Copying")) throw err;
            }

            // 5. Mint on-chain with anti-copying enforcement
            let tx;
            const hashToPass = contentHash || ethers.ZeroHash;
            try {
                if (typeof contract.registerPropertyWithDetails === "function") {
                    tx = await contract.registerPropertyWithDetails(cid, hashToPass, title || file.name);
                } else if (typeof contract.registerPropertyWithHash === "function") {
                    tx = await contract.registerPropertyWithHash(cid, hashToPass);
                } else {
                    tx = await contract.registerProperty(cid);
                }
                await tx.wait();
            } catch (contractErr) {
                const errMsg = contractErr?.reason || contractErr?.message || "";
                if (errMsg.includes("already registered") || errMsg.includes("IP Protection")) {
                    throw new Error(
                        "Smart contract transaction reverted: This asset or image is already registered on the blockchain. Duplicate registration was blocked by IPRegistry."
                    );
                }
                throw contractErr;
            }

            const count = await contract.propertyCounter();
            const newId = Number(count) - 1;
            const prop = await contract.properties(BigInt(newId));
            const userAddr = await getAddress();

            setResult({ id: newId, cid, shareToken: prop.shareToken });

            // Sync with ML service corpus database
            await syncAssetToMLCorpus(newId, title || file.name, cid, userAddr, file);

            showToast?.("Property minted and indexed into ML corpus!", "success");
            onRegistered?.();
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setBusy(false);
            setPct(null);
        }
    };

    const isHighRisk = auditReport?.risk_level === "HIGH" || auditReport?.status === "INFRINGING_COPY" || auditReport?.status === "PLAGIARISM_DETECTED";

    return (
        <div style={{ maxWidth: 640 }}>
            <h2 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                Register Intellectual Property
            </h2>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 24 }}>
                Upload digital content, audit against existing IP with ML forensics, and mint on-chain.
            </div>

            <div style={{ ...css.card }}>
                <Field label="Asset Title (Optional)">
                    <input
                        style={css.input}
                        placeholder="e.g. My Revolutionary Protocol Specification"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </Field>

                <Field label="Select Asset File" hint={`Max ${MAX_FILE_MB}MB · Images, PDFs, Code, Text Documents`}>
                    <div
                        style={{
                            border: "1.5px dashed var(--border2)",
                            borderRadius: 10,
                            padding: 28,
                            textAlign: "center",
                            position: "relative",
                            cursor: "pointer",
                            background: file ? "rgba(108,71,255,.04)" : "transparent"
                        }}
                    >
                        <input
                            type="file"
                            onChange={onFileChange}
                            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                        />
                        {file ? (
                            <div>
                                <div style={{ color: "var(--green)", fontSize: 14, fontWeight: 500 }}>
                                    ✓ {file.name}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                                    {(file.size / 1024).toFixed(1)} KB · Click to replace
                                </div>
                            </div>
                        ) : (
                            <div style={{ color: "var(--muted)" }}>
                                <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                                <div style={{ fontSize: 13 }}>Drop file here or click to browse</div>
                            </div>
                        )}
                        {pct !== null && (
                            <div style={{ marginTop: 12, height: 4, background: "var(--bg4)", borderRadius: 2 }}>
                                <div
                                    style={{
                                        height: "100%",
                                        width: `${pct}%`,
                                        background: "var(--accent)",
                                        borderRadius: 2,
                                        transition: "width .3s"
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </Field>

                {/* Audit trigger or loading status */}
                {file && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <button
                            style={{ ...css.btn("ghost"), fontSize: 11, padding: "6px 12px" }}
                            onClick={() => runMLAudit()}
                            disabled={auditing}
                        >
                            {auditing ? <><Spinner /> Checking ML Similarity…</> : "Re-run ML Forensics Audit"}
                        </button>
                        {auditReport && (
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                Audited: {auditReport.risk_level} Risk
                            </span>
                        )}
                    </div>
                )}

                {/* Plagiarism & Transformation Audit Report Component */}
                {auditing && (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
                        <Spinner /> <span style={{ marginLeft: 8 }}>Running deep perceptual & NLP similarity check…</span>
                    </div>
                )}
                {auditReport && !auditing && <PlagiarismReport report={auditReport} />}

                {/* Submit button with strict IP protection validation */}
                <div style={{ marginTop: 20 }}>
                    <button
                        style={{
                            ...css.btn(isHighRisk ? "warning" : "primary", busy || !file || auditing || isHighRisk),
                            width: "100%",
                            padding: 14,
                            opacity: (isHighRisk || auditing) ? 0.6 : 1,
                            cursor: (isHighRisk || auditing || busy || !file) ? "not-allowed" : "pointer"
                        }}
                        onClick={register}
                        disabled={busy || !file || auditing || isHighRisk}
                    >
                        {busy ? (
                            <>
                                <Spinner /> &nbsp;Pinning to IPFS & Minting On-Chain…
                            </>
                        ) : auditing ? (
                            <>
                                <Spinner /> &nbsp;Auditing Asset Similarity…
                            </>
                        ) : isHighRisk ? (
                            "⛔ Registration Blocked: Duplicate / Infringing Content"
                        ) : (
                            "Mint IP Asset & Index to ML Corpus"
                        )}
                    </button>
                    {isHighRisk && (
                        <div style={{
                            marginTop: 12,
                            padding: "12px 14px",
                            borderRadius: 8,
                            background: "rgba(255, 68, 68, 0.08)",
                            border: "1px solid rgba(255, 68, 68, 0.3)",
                            color: "#ff6b6b",
                            fontSize: 12,
                            lineHeight: 1.5
                        }}>
                            <strong>🚫 Intellectual Property Protection Alert:</strong> Minting is strictly blocked because this asset matches existing registered IP #{auditReport.best_match?.id !== undefined ? auditReport.best_match.id : "?"} {auditReport.best_match?.title ? `("${auditReport.best_match.title}")` : ""} with {auditReport.percentage}% similarity. Re-registering copied or derivative images under a different title or ID is prevented.
                        </div>
                    )}
                </div>
            </div>

            {/* Success Result Card */}
            {result && (
                <div className="fade-up" style={{ ...css.card, marginTop: 18, borderColor: "var(--green)" }}>
                    <div style={{ color: "var(--green)", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                        ✓ IP Property Registered & Fingerprinted
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                            ["Property ID", result.id],
                            ["Version", "v1 (Initial Lock)"],
                            ["IPFS CID", result.cid],
                            ["Share Token", short(result.shareToken)],
                            ["Fractional Shares", "1000 / 1000 (100% Owned)"],
                            ["ML Corpus Index", "Indexed & Protected"],
                        ].map(([k, v]) => (
                            <div
                                key={k}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: 12,
                                    padding: "6px 0",
                                    borderBottom: "1px solid var(--border)"
                                }}
                            >
                                <span style={{ color: "var(--muted)" }}>{k}</span>
                                <span style={{ color: "var(--text)", fontWeight: 500 }}>{String(v)}</span>
                            </div>
                        ))}
                    </div>
                    <a
                        href={`https://gateway.pinata.cloud/ipfs/${result.cid}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            display: "block",
                            textAlign: "center",
                            marginTop: 14,
                            fontSize: 12,
                            color: "var(--accent)",
                            textDecoration: "none"
                        }}
                    >
                        View content on IPFS Gateway ↗
                    </a>
                </div>
            )}
        </div>
    );
}
