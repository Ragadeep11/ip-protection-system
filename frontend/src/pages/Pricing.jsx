import React, { useState } from "react";
import { css, Field, Spinner, fmt } from "../components/UIPrimitives";
import { getContract } from "../contract";

const BASE = 0.01, INC = 0.001, CAP = 10;
const priceAt = (sold) => parseFloat((BASE + INC * (Math.min(Math.floor(sold / 10) + 1, CAP) - 1)).toFixed(4));
const CURVE = Array.from({ length: 11 }, (_, i) => ({ sales: i * 10, price: priceAt(i * 10) }));

export function Pricing() {
    const [propertyId, setPropertyId] = useState("");
    const [price, setPrice] = useState(null);
    const [sold, setSold] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        if (!propertyId) return;
        setLoading(true);
        try {
            const contract = await getContract();
            const [p, prop] = await Promise.all([
                contract.getLicensePrice(BigInt(propertyId)),
                contract.properties(BigInt(propertyId))
            ]);
            setPrice(fmt(p));
            setSold(Number(prop.licensesSold));
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const maxH = 100;
    const maxP = 0.025;

    return (
        <div style={{ maxWidth: 600 }}>
            <h2 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                Dynamic Pricing Bonding Curve
            </h2>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 28 }}>
                Automated demand-driven price discovery enforced directly by the smart contract.
            </div>

            <div style={{ ...css.card, marginBottom: 20 }}>
                <Field label="Check Property Price">
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            style={css.input}
                            type="number"
                            placeholder="e.g. 0"
                            value={propertyId}
                            onChange={(e) => setPropertyId(e.target.value)}
                        />
                        <button
                            style={{ ...css.btn("primary", loading), whiteSpace: "nowrap" }}
                            onClick={load}
                            disabled={loading || !propertyId}
                        >
                            {loading ? <Spinner /> : "Inspect Price"}
                        </button>
                    </div>
                </Field>

                {price !== null && (
                    <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                        <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "12px 14px" }}>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>Current Price</div>
                            <div style={{ fontSize: 20, fontFamily: "Syne", fontWeight: 700, color: "var(--green)", marginTop: 2 }}>
                                {price} ETH
                            </div>
                        </div>
                        <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "12px 14px" }}>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>Total Sold</div>
                            <div style={{ fontSize: 20, fontFamily: "Syne", fontWeight: 700, marginTop: 2 }}>
                                {sold}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Visual Bonding Curve Chart */}
            <div style={{ ...css.card }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Dynamic Bonding Curve</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>
                    Formula: <code>price = base + increment * (min(sales/10, 10))</code>
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 6,
                        height: maxH + 20,
                        padding: "10px 0",
                        borderBottom: "1px solid var(--border)"
                    }}
                >
                    {CURVE.map((c, i) => (
                        <div
                            key={c.sales}
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 4,
                                height: "100%",
                                justifyContent: "flex-end"
                            }}
                        >
                            <div
                                style={{
                                    width: "100%",
                                    height: `${(c.price / maxP) * maxH}px`,
                                    background:
                                        i === 0
                                            ? "var(--green)"
                                            : i === CURVE.length - 1
                                            ? "var(--red)"
                                            : "var(--accent)",
                                    borderRadius: "3px 3px 0 0",
                                    opacity: 0.5 + i * 0.05,
                                    minHeight: 4
                                }}
                            />
                            <div style={{ fontSize: 9, color: "var(--muted)" }}>{c.sales}</div>
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: "var(--muted)",
                        marginTop: 10
                    }}
                >
                    <span style={{ color: "var(--green)" }}>■ Base: 0.010 ETH</span>
                    <span>X-Axis: Total Licenses Sold</span>
                    <span style={{ color: "var(--red)" }}>■ Max Cap: 0.020 ETH</span>
                </div>
            </div>
        </div>
    );
}
