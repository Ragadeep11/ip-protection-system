import React, { useState } from "react";
import { css, Spinner } from "./UIPrimitives";

export function BuyModal({ property, onClose, onConfirm }) {
    const [buying, setBuying] = useState(false);

    const handleBuy = async () => {
        setBuying(true);
        try {
            await onConfirm(property);
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setBuying(false);
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(7,7,15,.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 200,
                backdropFilter: "blur(4px)"
            }}
        >
            <div style={{ ...css.card, width: 400, borderColor: "var(--border2)" }}>
                <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                    Buy License
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
                    Your license will be locked to the current version of this property.
                </div>

                {[
                    ["Property", `#${property.id}`],
                    ["Current Version", `v${property.version}`],
                    ["Your license locked to", `v${property.version}`],
                    ["Price", `${property.price} ETH`],
                    ["Duration", "1 day (86400s)"],
                ].map(([k, v]) => (
                    <div
                        key={k}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            padding: "8px 0",
                            borderBottom: "1px solid var(--border)"
                        }}
                    >
                        <span style={{ color: "var(--muted)" }}>{k}</span>
                        <span
                            style={{
                                color:
                                    k === "Price"
                                        ? "var(--green)"
                                        : k.includes("locked")
                                        ? "var(--amber)"
                                        : "var(--text)",
                                fontWeight: 500
                            }}
                        >
                            {v}
                        </span>
                    </div>
                ))}

                <div
                    style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        marginTop: 14,
                        padding: "10px 12px",
                        background: "var(--bg3)",
                        borderRadius: 6,
                        lineHeight: 1.4
                    }}
                >
                    If this property updates to v{property.version + 1} later, you will NOT have access to it.
                    Version lock is cryptographically enforced on-chain.
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    <button style={{ ...css.btn("ghost"), flex: 1 }} onClick={onClose} disabled={buying}>
                        Cancel
                    </button>
                    <button
                        style={{ ...css.btn("success", buying), flex: 2 }}
                        onClick={handleBuy}
                        disabled={buying}
                    >
                        {buying ? (
                            <>
                                <Spinner /> &nbsp;Confirm in MetaMask…
                            </>
                        ) : (
                            `Confirm — ${property.price} ETH`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
