import React, { useState } from "react";
import { css, Field, Spinner, MAX_FILE_MB } from "../components/UIPrimitives";
import { getContract, getAddress } from "../contract";
import axios from "axios";

export function MyLicenses() {
    const [propertyId, setPropertyId] = useState("");
    const [licInfo, setLicInfo] = useState(null);
    const [vCheck, setVCheck] = useState(null);
    const [busy, setBusy] = useState(false);
    const [updateFile, setUpdateFile] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [currentVer, setCurrentVer] = useState(null);

    const check = async () => {
        if (!propertyId) return;
        setBusy(true);
        try {
            const contract = await getContract();
            const myAddr = await getAddress();
            const [ver, expiry, active, sharesBacked] = await contract.getLicenseInfo(
                BigInt(propertyId),
                myAddr
            );
            const valid = await contract.isLicenseValid(BigInt(propertyId), myAddr);
            const cvr = await contract.getCurrentVersion(BigInt(propertyId));
            setCurrentVer(Number(cvr));

            // version lock check for all versions
            const results = [];
            for (let v = 1; v <= Number(cvr); v++) {
                const ok = await contract.isLicenseValidForVersion(
                    BigInt(propertyId),
                    myAddr,
                    BigInt(v)
                );
                results.push({ version: v, valid: ok });
            }
            setLicInfo({
                valid,
                version: Number(ver),
                active,
                sharesBacked: Number(sharesBacked),
                expiry:
                    Number(expiry) === 0
                        ? "Not set"
                        : new Date(Number(expiry) * 1000).toLocaleString()
            });
            setVCheck(results);
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setBusy(false);
        }
    };

    const uploadToIPFS = async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        const jwt = import.meta.env.VITE_PINATA_JWT;
        const res = await axios.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            formData,
            {
                headers: { Authorization: `Bearer ${jwt}` },
                timeout: 30000
            }
        );
        return res.data.IpfsHash;
    };

    const update = async () => {
        if (!updateFile || !propertyId) return alert("Select a file and provide property ID");
        setUpdating(true);
        try {
            const cid = await uploadToIPFS(updateFile);
            const contract = await getContract();
            const tx = await contract.updateProperty(BigInt(propertyId), cid);
            await tx.wait();
            alert("Property updated to new version!");
            check();
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div style={{ maxWidth: 540 }}>
            <h2 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                My Licenses & Version Locks
            </h2>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 28 }}>
                Check license validity and verify strict cryptographic version locking.
            </div>

            <div style={{ ...css.card, marginBottom: 20 }}>
                <Field label="Property ID">
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            style={css.input}
                            type="number"
                            placeholder="e.g. 0"
                            value={propertyId}
                            onChange={(e) => setPropertyId(e.target.value)}
                        />
                        <button
                            style={{ ...css.btn("primary", busy), whiteSpace: "nowrap" }}
                            onClick={check}
                            disabled={busy}
                        >
                            {busy ? <Spinner /> : "Check License"}
                        </button>
                    </div>
                </Field>
            </div>

            {licInfo && (
                <div className="fade-up" style={{ ...css.card, marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700 }}>
                            License Status
                        </div>
                        <span style={css.pill(licInfo.valid ? "green" : "red")}>
                            {licInfo.valid ? "Active & Valid" : "Inactive / Expired"}
                        </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                        {[
                            ["Your License Locked to", `Version ${licInfo.version}`],
                            ["Latest On-Chain Version", `Version ${currentVer}`],
                            ["Expiry", licInfo.expiry],
                            ["Shares Backed", licInfo.sharesBacked > 0 ? "Yes" : "No"]
                        ].map(([k, v]) => (
                            <div
                                key={k}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "6px 0",
                                    borderBottom: "1px solid var(--border)"
                                }}
                            >
                                <span style={{ color: "var(--muted)" }}>{k}</span>
                                <span style={{ color: "var(--text)", fontWeight: 500 }}>{v}</span>
                            </div>
                        ))}
                    </div>

                    {vCheck && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
                                Version Access Matrix
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {vCheck.map((v) => (
                                    <div
                                        key={v.version}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            padding: "8px 12px",
                                            background: "var(--bg3)",
                                            borderRadius: 6,
                                            fontSize: 12
                                        }}
                                    >
                                        <span>Access to Version {v.version}</span>
                                        <span style={css.pill(v.valid ? "green" : "red")}>
                                            {v.valid ? "Granted" : "Locked (No Access)"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Owner Update Section */}
            {propertyId && (
                <div style={{ ...css.card }}>
                    <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                        Property Owner: Publish Version Update
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
                        Upload a new iteration. This will increment the on-chain version and revoke access from previous version licenses.
                    </div>
                    <Field label="New Version File" hint={`Max ${MAX_FILE_MB}MB`}>
                        <input
                            type="file"
                            onChange={(e) => setUpdateFile(e.target.files[0])}
                            style={{ color: "var(--text)", fontSize: 12 }}
                        />
                    </Field>
                    <button
                        style={{ ...css.btn("primary", updating || !updateFile), width: "100%", padding: 10 }}
                        onClick={update}
                        disabled={updating || !updateFile}
                    >
                        {updating ? <><Spinner /> Uploading & Updating…</> : "Publish New Version"}
                    </button>
                </div>
            )}
        </div>
    );
}
