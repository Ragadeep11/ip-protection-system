import React, { useState, useEffect } from "react";
import { css, Spinner, fmt } from "../components/UIPrimitives";
import { getContract } from "../contract";

export function Marketplace({ onBuy }) {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const contract = await getContract();
                const count = Number(await contract.propertyCounter());
                const items = [];
                for (let i = 0; i < count; i++) {
                    const prop = await contract.properties(BigInt(i));
                    const price = await contract.getLicensePrice(BigInt(i));
                    const cid = await contract.versionCids(BigInt(i), prop.currentVersion);
                    items.push({
                        id: i,
                        version: Number(prop.currentVersion),
                        sold: Number(prop.licensesSold),
                        price: fmt(price),
                        priceWei: price,
                        cid,
                        pool: fmt(prop.revenuePool),
                        title: prop.title || `Property #${i}`,
                        blockNumber: prop.blockNumber && Number(prop.blockNumber) > 0 ? Number(prop.blockNumber) : null,
                    });
                }
                setProperties(items);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: 80, color: "var(--muted)" }}>
                <Spinner /> <span style={{ marginLeft: 10 }}>Loading marketplace…</span>
            </div>
        );
    }

    if (!properties.length) {
        return (
            <div style={{ textAlign: "center", padding: 80, color: "var(--muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>◻</div>
                <div style={{ fontSize: 14 }}>No properties registered yet.</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Go to Register IP to mint the first protected asset.</div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                    IP Marketplace
                </h2>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {properties.length} verified {properties.length === 1 ? "property" : "properties"} · Buy a
                    version-locked license to access protected assets
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 16 }}>
                {properties.map((p) => (
                    <div
                        key={p.id}
                        className="fade-up"
                        style={{
                            ...css.card,
                            borderRadius: 14,
                            padding: 20,
                            display: "flex",
                            flexDirection: "column",
                            gap: 14
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ flex: 1, marginRight: 8 }}>
                                <div style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700 }}>
                                    {p.title}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                                    Property #{p.id} · {p.cid ? `${p.cid.slice(0, 14)}…` : "No CID"}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {p.blockNumber && (
                                    <span style={{ ...css.pill("green"), fontSize: 10 }}>
                                        Block #{p.blockNumber}
                                    </span>
                                )}
                                <span style={css.pill("accent")}>v{p.version}</span>
                            </div>
                        </div>

                        {/* IPFS Link */}
                        <a
                            href={`https://gateway.pinata.cloud/ipfs/${p.cid}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                fontSize: 11,
                                color: "var(--accent)",
                                textDecoration: "none",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                padding: "6px 10px",
                                display: "block",
                                textAlign: "center"
                            }}
                        >
                            View on IPFS ↗
                        </a>

                        {/* Stats */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    Current Price
                                </div>
                                <div style={{ fontSize: 17, fontFamily: "Syne", fontWeight: 700, color: "var(--green)", marginTop: 2 }}>
                                    {p.price} ETH
                                </div>
                            </div>
                            <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    Licenses Sold
                                </div>
                                <div style={{ fontSize: 17, fontFamily: "Syne", fontWeight: 700, marginTop: 2 }}>
                                    {p.sold}
                                </div>
                            </div>
                        </div>

                        {/* Price note */}
                        <div style={{ fontSize: 11, color: "var(--muted)", background: "var(--bg3)", borderRadius: 6, padding: "6px 10px" }}>
                            Next dynamic increment at {Math.ceil((p.sold + 1) / 10) * 10} sales
                        </div>

                        {/* Buy Button */}
                        <button
                            style={{ ...css.btn("success"), width: "100%", padding: "12px" }}
                            onClick={() => onBuy(p)}
                        >
                            Buy License — {p.price} ETH
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
