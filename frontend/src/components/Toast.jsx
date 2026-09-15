import React from "react";

export const Toast = ({ msg, type }) => {
    if (!msg) return null;
    const color =
        type === "success"
            ? "var(--green)"
            : type === "error"
            ? "var(--red)"
            : type === "warning"
            ? "var(--amber)"
            : "var(--muted2)";

    return (
        <div
            style={{
                position: "fixed",
                bottom: 28,
                left: "50%",
                transform: "translateX(-50%)",
                background: "var(--bg3)",
                border: `1px solid ${color}`,
                borderRadius: 12,
                padding: "12px 20px",
                fontSize: 13,
                maxWidth: 540,
                width: "90%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                zIndex: 999,
                boxShadow: "0 8px 32px rgba(0,0,0,.5)"
            }}
        >
            <span style={{ color, fontSize: 16, fontWeight: 700 }}>
                {type === "success" ? "✓" : type === "error" ? "✕" : type === "warning" ? "⚠" : "⟳"}
            </span>
            <span style={{ color: "var(--text)", flex: 1 }}>{msg}</span>
        </div>
    );
};
