import React, { useState } from "react";
import { ethers } from "ethers";
import { css, Field, Spinner, short, fmt } from "../components/UIPrimitives";
import { getContract, getSigner, getAddress, contractAddress } from "../contract";

export function Shares() {
    const [propertyId, setPropertyId] = useState("");
    const [myShares, setMyShares] = useState(null);
    const [recipient, setRecipient] = useState("");
    const [amount, setAmount] = useState("");
    const [revenue, setRevenue] = useState(null);
    const [shareToken, setShareToken] = useState("");
    const [busy, setBusy] = useState("");

    const loadShares = async () => {
        if (!propertyId) return;
        setBusy("loading");
        try {
            const contract = await getContract();
            const myAddr = await getAddress();
            const bal = await contract.getShareBalance(BigInt(propertyId), myAddr);
            const prop = await contract.properties(BigInt(propertyId));
            setMyShares(Number(bal));
            setShareToken(prop.shareToken);
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setBusy("");
        }
    };

    const transferShares = async () => {
        if (!propertyId || !recipient || !amount) return;
        setBusy("transfer");
        try {
            const contract = await getContract();
            const token = shareToken || (await contract.getShareToken(BigInt(propertyId)));
            const signer = await getSigner();
            const erc20 = new ethers.Contract(
                token,
                ["function approve(address,uint256) returns(bool)"],
                signer
            );
            await (await erc20.approve(contractAddress, BigInt(amount))).wait();
            await (await contract.transferShares(BigInt(propertyId), recipient, BigInt(amount))).wait();
            await loadShares();
            setRecipient("");
            setAmount("");
            alert(`✓ ${amount} shares transferred to ${short(recipient)}`);
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setBusy("");
        }
    };

    const claimShareLicense = async () => {
        if (!propertyId) return;
        setBusy("claimLic");
        try {
            const contract = await getContract();
            await (await contract.claimShareHolderLicense(BigInt(propertyId), BigInt(86400))).wait();
            alert("✓ Free license claimed via share ownership!");
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setBusy("");
        }
    };

    const checkRevenue = async () => {
        if (!propertyId) return;
        setBusy("revenue");
        try {
            const contract = await getContract();
            const myAddr = await getAddress();
            const claimable = await contract.claimableRevenue(BigInt(propertyId), myAddr);
            const prop = await contract.properties(BigInt(propertyId));
            setRevenue({ claimable: fmt(claimable), pool: fmt(prop.revenuePool) });
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setBusy("");
        }
    };

    const withdrawRevenue = async () => {
        if (!propertyId) return;
        setBusy("withdraw");
        try {
            const contract = await getContract();
            await (await contract.withdrawRevenue(BigInt(propertyId))).wait();
            setRevenue(null);
            alert("✓ Revenue withdrawn to your wallet!");
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setBusy("");
        }
    };

    const pct = myShares !== null ? ((myShares / 1000) * 100).toFixed(1) : null;

    return (
        <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                Fractional Shares & Royalties
            </h2>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 28 }}>
                Fractional ownership of IP assets · Earn proportional revenue from every license sale
            </div>

            {/* Property ID + load */}
            <div style={{ ...css.card, marginBottom: 16 }}>
                <Field label="Property ID">
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            style={css.input}
                            type="number"
                            placeholder="e.g. 0"
                            value={propertyId}
                            onChange={(e) => {
                                setPropertyId(e.target.value);
                                setMyShares(null);
                                setRevenue(null);
                            }}
                        />
                        <button
                            style={{
                                ...css.btn("primary", busy === "loading" || !propertyId),
                                padding: "10px 16px",
                                whiteSpace: "nowrap"
                            }}
                            onClick={loadShares}
                            disabled={busy === "loading" || !propertyId}
                        >
                            {busy === "loading" ? <Spinner /> : "Load Shares"}
                        </button>
                    </div>
                </Field>

                {myShares !== null && (
                    <div className="fade-up">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>Your share balance</span>
                            <span style={css.pill("accent")}>{pct}% ownership</span>
                        </div>
                        <div style={{ fontSize: 28, fontFamily: "Syne", fontWeight: 700, marginBottom: 8 }}>
                            {myShares}{" "}
                            <span style={{ fontSize: 14, color: "var(--muted)", fontFamily: "'IBM Plex Mono'" }}>
                                / 1000 shares
                            </span>
                        </div>
                        <div style={{ height: 6, background: "var(--bg4)", borderRadius: 3 }}>
                            <div
                                style={{
                                    height: "100%",
                                    width: `${pct}%`,
                                    background: "var(--accent)",
                                    borderRadius: 3,
                                    transition: "width .5s"
                                }}
                            />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                            Share token: {short(shareToken)}
                        </div>
                        <button
                            style={{ ...css.btn("ghost", busy === "claimLic"), marginTop: 12, width: "100%", fontSize: 12 }}
                            onClick={claimShareLicense}
                            disabled={busy === "claimLic" || myShares === 0}
                        >
                            {busy === "claimLic" ? <Spinner /> : "Claim Free Shareholder License"}
                        </button>
                    </div>
                )}
            </div>

            {/* Transfer */}
            <div style={{ ...css.card, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Transfer Fractional Shares</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
                    Send shares to simulate fractional co-ownership.
                </div>
                <Field label="Recipient address">
                    <input
                        style={css.input}
                        placeholder="0x…"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                    />
                </Field>
                <Field label="Amount of shares" hint="Total supply is 1000 shares.">
                    <input
                        style={css.input}
                        type="number"
                        placeholder="e.g. 300"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </Field>
                <button
                    style={{ ...css.btn("primary", busy === "transfer" || !recipient || !amount), width: "100%" }}
                    onClick={transferShares}
                    disabled={busy === "transfer" || !recipient || !amount}
                >
                    {busy === "transfer" ? <><Spinner /> &nbsp;Approving & Transferring…</> : "Transfer Shares"}
                </button>
            </div>

            {/* Revenue Pool */}
            <div style={{ ...css.card }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Revenue from License Sales</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
                    Every license purchase accumulates in the revenue pool. Each shareholder withdraws their proportional cut.
                </div>
                <button
                    style={{ ...css.btn("ghost", busy === "revenue" || !propertyId), width: "100%", marginBottom: 12 }}
                    onClick={checkRevenue}
                    disabled={busy === "revenue" || !propertyId}
                >
                    {busy === "revenue" ? <Spinner /> : "Check My Claimable Revenue"}
                </button>
                {revenue && (
                    <div className="fade-up" style={{ background: "var(--bg3)", borderRadius: 10, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                            <div>
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>Total Pool</div>
                                <div style={{ fontSize: 20, fontFamily: "Syne", fontWeight: 700 }}>
                                    {revenue.pool} ETH
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>Your Share</div>
                                <div style={{ fontSize: 20, fontFamily: "Syne", fontWeight: 700, color: "var(--green)" }}>
                                    {revenue.claimable} ETH
                                </div>
                            </div>
                        </div>
                        {parseFloat(revenue.claimable) > 0 ? (
                            <button
                                style={{ ...css.btn("success", busy === "withdraw"), width: "100%" }}
                                onClick={withdrawRevenue}
                                disabled={busy === "withdraw"}
                            >
                                {busy === "withdraw" ? <Spinner /> : `Withdraw ${revenue.claimable} ETH`}
                            </button>
                        ) : (
                            <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", padding: 6 }}>
                                Nothing to withdraw yet — purchase licenses to accumulate revenue
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
