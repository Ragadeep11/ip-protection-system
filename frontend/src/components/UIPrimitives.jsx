import React from "react";
import { ethers } from "ethers";

export const MAX_FILE_MB = 5;

export const fmt = (w) => {
    try {
        return parseFloat(ethers.formatEther(w)).toFixed(4);
    } catch {
        return "0.0000";
    }
};

export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export const css = {
    card: {
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 24,
        transition: "border-color .2s"
    },
    cardHover: { borderColor: "var(--border2)" },
    btn: (variant = "primary", disabled = false) => ({
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 13,
        fontWeight: 500,
        padding: "10px 20px",
        borderRadius: 8,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: "0.02em",
        transition: "all .15s",
        opacity: disabled ? 0.5 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        ...(variant === "primary" ? { background: "var(--accent)", color: "#fff" } :
            variant === "success" ? { background: "var(--green)", color: "#07070f", fontWeight: 600 } :
            variant === "danger"  ? { background: "transparent", color: "var(--red)", border: "1px solid var(--red)" } :
            variant === "warning" ? { background: "var(--amber)", color: "#07070f", fontWeight: 600 } :
            variant === "ghost"   ? { background: "transparent", color: "var(--muted2)", border: "1px solid var(--border)" } :
            { background: "transparent", color: "var(--text)", border: "1px solid var(--border)" })
    }),
    input: {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 13,
        background: "var(--bg3)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        padding: "10px 14px",
        borderRadius: 8,
        outline: "none",
        width: "100%"
    },
    label: {
        fontSize: 11,
        fontWeight: 500,
        color: "var(--muted2)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 6,
        display: "block"
    },
    pill: (color = "accent") => ({
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        padding: "3px 10px",
        borderRadius: 20,
        ...(color === "green"  ? { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(0,212,170,.2)" } :
            color === "red"    ? { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(255,69,96,.2)" } :
            color === "amber"  ? { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(255,184,77,.2)" } :
            { background: "rgba(108,71,255,.15)", color: "var(--accent)", border: "1px solid rgba(108,71,255,.25)" })
    })
};

export const Spinner = () => (
    <span
        style={{
            display: "inline-block",
            width: 14,
            height: 14,
            border: "2px solid var(--border2)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin .7s linear infinite"
        }}
    />
);

export const Field = ({ label, children, hint }) => (
    <div style={{ marginBottom: 18 }}>
        <label style={css.label}>{label}</label>
        {children}
        {hint && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>{hint}</div>}
    </div>
);

export const Divider = () => <div style={{ borderTop: "1px solid var(--border)", margin: "20px 0" }} />;
