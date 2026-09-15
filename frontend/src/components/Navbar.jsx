import React from "react";

export const Navbar = ({ activePage, onSelectPage }) => {
    const NAV = [
        { id: "market", label: "Marketplace" },
        { id: "register", label: "Register IP" },
        { id: "verify", label: "Verify & Forensics" },
        { id: "licenses", label: "My Licenses" },
        { id: "shares", label: "Shares" },
        { id: "pricing", label: "Pricing" },
    ];

    return (
        <div
            style={{
                borderBottom: "1px solid var(--border)",
                background: "var(--bg2)",
                position: "sticky",
                top: 0,
                zIndex: 100
            }}
        >
            <div
                style={{
                    maxWidth: 1150,
                    margin: "0 auto",
                    padding: "0 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    height: 64
                }}
            >
                {/* Brand Logo */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            background: "linear-gradient(135deg, var(--accent) 0%, #a259ff 100%)",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#fff",
                            fontFamily: "Syne",
                            boxShadow: "0 2px 10px var(--accent-glow)"
                        }}
                    >
                        IP
                    </div>
                    <div>
                        <div
                            style={{
                                fontFamily: "Syne",
                                fontWeight: 800,
                                fontSize: 16,
                                letterSpacing: "-0.02em"
                            }}
                        >
                            ChainLicense <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 500 }}>AI/ML</span>
                        </div>
                        <div
                            style={{
                                fontSize: 9,
                                color: "var(--muted)",
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                marginTop: -2
                            }}
                        >
                            Decentralized IP & Plagiarism Protection
                        </div>
                    </div>
                </div>

                {/* Navigation Links */}
                <div style={{ display: "flex", gap: 6 }}>
                    {NAV.map((n) => {
                        const isActive = activePage === n.id;
                        return (
                            <button
                                key={n.id}
                                onClick={() => onSelectPage(n.id)}
                                style={{
                                    fontFamily: "'IBM Plex Mono', monospace",
                                    fontSize: 12,
                                    padding: "8px 14px",
                                    borderRadius: 7,
                                    border: "none",
                                    cursor: "pointer",
                                    transition: "all .15s",
                                    background: isActive ? "var(--bg4)" : "transparent",
                                    color: isActive ? "var(--text)" : "var(--muted)",
                                    borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                                    fontWeight: isActive ? 600 : 400
                                }}
                            >
                                {n.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
