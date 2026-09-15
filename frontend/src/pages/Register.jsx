import React, { useState } from "react";
import { css, Field, Spinner, MAX_FILE_MB, short } from "../components/UIPrimitives";
import { PlagiarismReport } from "../components/PlagiarismReport";
import { verifyIPAsset, syncAssetToMLCorpus } from "../services/mlService";
import { getContract, getAddress } from "../contract";
import axios from "axios";

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

    const register = async () => {
        if (!file) return alert("Please select a file first");

        // Safety verification check
        if (auditReport && auditReport.risk_level === "HIGH") {
            const confirmProceed = window.confirm(
                "Warning: ML Audit detected high similarity or derivative transformation with existing protected IP. Are you sure you want to register this asset?"
            );
            if (!confirmProceed) return;
        }

        setBusy(true);
        setResult(null);
        try {
            setPct(0);
            const cid = await uploadToIPFS(file, (p) => setPct(p));
            setPct(null);

            const contract = await getContract();
            const tx = await contract.registerProperty(cid);
            await tx.wait();

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

    const isHighRisk = auditReport?.risk_level === "HIGH";

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

                {/* Submit button with smart validation */}
                <div style={{ marginTop: 20 }}>
                    <button
                        style={{
                            ...css.btn(isHighRisk ? "warning" : "primary", busy || !file),
                            width: "100%",
                            padding: 14
                        }}
                        onClick={register}
                        disabled={busy || !file}
                    >
                        {busy ? (
                            <>
                                <Spinner /> &nbsp;Pinning to IPFS & Minting On-Chain…
                            </>
                        ) : isHighRisk ? (
                            "⚠ Proceed with Mint (Similarity Warning)"
                        ) : (
                            "Mint IP Asset & Index to ML Corpus"
                        )}
                    </button>
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
