import React, { useState, useEffect } from "react";
import { css, Field, Spinner, MAX_FILE_MB } from "../components/UIPrimitives";
import { PlagiarismReport } from "../components/PlagiarismReport";
import { verifyIPAsset, fetchCorpus } from "../services/mlService";

export function VerifyIP() {
    const [mode, setMode] = useState("file"); // "file" or "text"
    const [file, setFile] = useState(null);
    const [rawText, setRawText] = useState("");
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [corpus, setCorpus] = useState([]);
    const [loadingCorpus, setLoadingCorpus] = useState(false);

    useEffect(() => {
        loadCorpus();
    }, []);

    const loadCorpus = async () => {
        setLoadingCorpus(true);
        try {
            const data = await fetchCorpus();
            setCorpus(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingCorpus(false);
        }
    };

    const handleVerify = async () => {
        if (mode === "file" && !file) return alert("Select a file first");
        if (mode === "text" && !rawText.trim()) return alert("Enter some text first");

        setLoading(true);
        setReport(null);
        try {
            const res = await verifyIPAsset(mode === "file" ? file : null, mode === "text" ? rawText : "");
            setReport(res);
        } catch (e) {
            alert("Verification failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 840 }}>
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                    IP Verification & Forensics Workbench
                </h2>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Analyze documents and media against registered blockchain intellectual property.
                    Detects plagiarism, syntactic shuffling, and geometric/photometric transformations.
                </div>
            </div>

            {/* Mode Selector Tabs */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <button
                    style={{
                        ...css.btn(mode === "file" ? "primary" : "ghost"),
                        fontSize: 12,
                        padding: "8px 16px"
                    }}
                    onClick={() => { setMode("file"); setReport(null); }}
                >
                    📁 Upload File (Image, PDF, Doc)
                </button>
                <button
                    style={{
                        ...css.btn(mode === "text" ? "primary" : "ghost"),
                        fontSize: 12,
                        padding: "8px 16px"
                    }}
                    onClick={() => { setMode("text"); setReport(null); }}
                >
                    📝 Raw Text / Code Snippet
                </button>
            </div>

            <div style={{ ...css.card }}>
                {mode === "file" ? (
                    <Field label="Choose Document or Image" hint={`Supports PNG, JPG, WEBP, PDF, TXT up to ${MAX_FILE_MB}MB`}>
                        <div
                            style={{
                                border: "1.5px dashed var(--border2)",
                                borderRadius: 10,
                                padding: 24,
                                textAlign: "center",
                                position: "relative",
                                cursor: "pointer",
                                background: file ? "rgba(108,71,255,.04)" : "transparent"
                            }}
                        >
                            <input
                                type="file"
                                onChange={(e) => { setFile(e.target.files[0]); setReport(null); }}
                                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                            />
                            {file ? (
                                <div style={{ color: "var(--green)", fontSize: 13, fontWeight: 500 }}>
                                    ✓ Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                                </div>
                            ) : (
                                <div style={{ color: "var(--muted)" }}>
                                    <div style={{ fontSize: 24, marginBottom: 6 }}>🔍</div>
                                    <div style={{ fontSize: 13 }}>Click or drag a file to run forensic audit</div>
                                </div>
                            )}
                        </div>
                    </Field>
                ) : (
                    <Field label="Input Text or Code to Verify" hint="Paste paragraph, paper abstract, or source code">
                        <textarea
                            style={{ ...css.input, minHeight: 140, resize: "vertical", lineHeight: 1.5 }}
                            placeholder="Paste text here to evaluate against registered IP corpus..."
                            value={rawText}
                            onChange={(e) => { setRawText(e.target.value); setReport(null); }}
                        />
                    </Field>
                )}

                <button
                    style={{ ...css.btn("primary", loading), width: "100%", padding: 12 }}
                    onClick={handleVerify}
                    disabled={loading || (mode === "file" && !file) || (mode === "text" && !rawText.trim())}
                >
                    {loading ? (
                        <>
                            <Spinner /> &nbsp;Extracting Features & Analyzing Corpus…
                        </>
                    ) : (
                        "Run Forensics & Plagiarism Audit"
                    )}
                </button>
            </div>

            {/* Results */}
            {report && <PlagiarismReport report={report} />}

            {/* Registered Corpus Section */}
            <div style={{ marginTop: 40 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                        <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700 }}>
                            Protected IP Corpus Database
                        </h3>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            All properties actively monitored by the ML protection network
                        </div>
                    </div>
                    <button
                        style={{ ...css.btn("ghost"), fontSize: 11, padding: "5px 10px" }}
                        onClick={loadCorpus}
                        disabled={loadingCorpus}
                    >
                        {loadingCorpus ? <Spinner /> : "↻ Refresh"}
                    </button>
                </div>

                {corpus.length === 0 ? (
                    <div style={{ ...css.card, textAlign: "center", padding: 30, color: "var(--muted)" }}>
                        No indexed properties in ML database yet. Mint a property to start indexing.
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {corpus.map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    ...css.card,
                                    padding: "12px 16px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: 12
                                }}
                            >
                                <div>
                                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                                        Property #{item.id}: {item.title || "Protected Asset"}
                                    </span>
                                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                                        Type: {item.type} · CID: <code style={{ color: "var(--accent)" }}>{item.cid}</code>
                                    </div>
                                </div>
                                <span style={css.pill("accent")}>Indexed & Active</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
