import React from "react";
import { css } from "./UIPrimitives";

export const PlagiarismReport = ({ report }) => {
    if (!report) return null;

    const {
        similarity_score = 0,
        percentage = 0,
        risk_level = "LOW",
        status = "CLEAN",
        verdict = "",
        best_match,
        transformation_analysis,
        type = "file"
    } = report;

    const isHigh = risk_level === "HIGH";
    const isMedium = risk_level === "MEDIUM";

    const badgeColor = isHigh ? "red" : isMedium ? "amber" : "green";
    const barColor = isHigh ? "var(--red)" : isMedium ? "var(--amber)" : "var(--green)";

    const transforms =
        transformation_analysis?.all_detected_transformations ||
        transformation_analysis?.detected_transformations ||
        [];

    const isTransformed = transformation_analysis?.is_transformed;

    return (
        <div
            className="fade-up"
            style={{
                ...css.card,
                marginTop: 20,
                borderColor: isHigh ? "var(--red)" : isMedium ? "var(--amber)" : "var(--green)",
                background: "var(--bg3)",
                borderRadius: 12
            }}
        >
            {/* Header / Score Banner */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: 16,
                    marginBottom: 16
                }}
            >
                <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        ML IP Audit & Forensics Report
                    </div>
                    <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                        Similarity Score: <span style={{ color: barColor }}>{percentage}%</span>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={css.pill(badgeColor)}>
                        {isHigh ? "⚠ HIGH RISK / INFRINGEMENT" : isMedium ? "⚡ SUSPECT DERIVATIVE" : "✓ VERIFIED ORIGINAL"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted2)", textTransform: "uppercase" }}>
                        [{type.toUpperCase()}]
                    </span>
                </div>
            </div>

            {/* Similarity Progress Bar */}
            <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                    <span style={{ color: "var(--muted2)" }}>Similarity Meter</span>
                    <span style={{ color: barColor, fontWeight: 600 }}>{percentage}% Match</span>
                </div>
                <div style={{ height: 8, background: "var(--bg4)", borderRadius: 4, overflow: "hidden" }}>
                    <div
                        style={{
                            height: "100%",
                            width: `${Math.min(100, Math.max(3, percentage))}%`,
                            background: barColor,
                            transition: "width .5s ease",
                            borderRadius: 4
                        }}
                    />
                </div>
            </div>

            {/* Verdict Explanation */}
            <div
                style={{
                    background: "var(--bg2)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    fontSize: 12,
                    lineHeight: 1.5,
                    borderLeft: `4px solid ${barColor}`,
                    marginBottom: 18
                }}
            >
                <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Audit Verdict:</div>
                <div style={{ color: "var(--muted2)" }}>{verdict}</div>
            </div>

            {/* Transformation Forensics Detection */}
            {isTransformed && (
                <div
                    style={{
                        background: "rgba(255, 69, 96, 0.08)",
                        border: "1px dashed var(--red)",
                        borderRadius: 8,
                        padding: "14px 16px",
                        marginBottom: 18
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--red)", fontWeight: 600, fontSize: 12, marginBottom: 8 }}>
                        <span>⚠ Derivative Transformation Detected</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 8 }}>
                        {transformation_analysis?.verdict || "This upload appears to be an altered derivative of an existing property."}
                    </div>
                    {transforms.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {transforms.map((t, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        fontSize: 11,
                                        background: "var(--bg3)",
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        display: "flex",
                                        justifyContent: "space-between"
                                    }}
                                >
                                    <span style={{ color: "var(--amber)", fontWeight: 500 }}>
                                        {t.transformation_type || t.type}
                                    </span>
                                    <span style={{ color: "var(--muted)" }}>
                                        {t.description || t.evidence || `Confidence: ${Math.round((t.confidence || 0) * 100)}%`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Best Match Details */}
            {best_match && (
                <div style={{ background: "var(--bg2)", borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
                        Closest Matching Protected Property
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                            Property #{best_match.id}: {best_match.title}
                        </div>
                        <span style={css.pill(badgeColor)}>
                            {Math.round(best_match.score * 100)}% overlap
                        </span>
                    </div>

                    {best_match.cid && (
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                            IPFS CID: <code style={{ color: "var(--accent)" }}>{best_match.cid}</code>
                        </div>
                    )}

                    {/* Matched sentence excerpts if available */}
                    {best_match.matched_sentences?.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 11, color: "var(--muted2)", marginBottom: 4 }}>Identified Excerpts:</div>
                            {best_match.matched_sentences.map((ms, i) => (
                                <div
                                    key={i}
                                    style={{
                                        fontSize: 11,
                                        background: "var(--bg3)",
                                        padding: "6px 10px",
                                        borderRadius: 4,
                                        marginBottom: 4,
                                        fontStyle: "italic",
                                        color: "var(--text)"
                                    }}
                                >
                                    "{ms.matched_excerpt}..." ({Math.round(ms.match_ratio * 100)}% match)
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
