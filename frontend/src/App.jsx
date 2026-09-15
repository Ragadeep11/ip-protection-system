import React, { useState } from "react";
import { Navbar } from "./components/Navbar";
import { Toast } from "./components/Toast";
import { BuyModal } from "./components/BuyModal";
import { Marketplace } from "./pages/Marketplace";
import { Register } from "./pages/Register";
import { VerifyIP } from "./pages/VerifyIP";
import { MyLicenses } from "./pages/MyLicenses";
import { Shares } from "./pages/Shares";
import { Pricing } from "./pages/Pricing";
import { getContract } from "./contract";

/* ================================================================
   GLOBAL STYLES INJECTION
================================================================ */
const injectStyles = () => {
    if (document.getElementById("cl-styles")) return;
    const s = document.createElement("style");
    s.id = "cl-styles";
    s.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#07070f;color:#e2e0f0;font-family:'IBM Plex Mono',monospace;min-height:100vh}
        :root{
            --bg:#07070f;--bg2:#0f0f1a;--bg3:#161625;--bg4:#1e1e30;
            --border:#252538;--border2:#32324a;
            --accent:#6c47ff;--accent-glow:rgba(108,71,255,0.25);
            --green:#00d4aa;--green-dim:rgba(0,212,170,0.15);
            --red:#ff4560;--red-dim:rgba(255,69,96,0.12);
            --amber:#ffb84d;--amber-dim:rgba(255,184,77,0.12);
            --text:#e2e0f0;--muted:#5a5870;--muted2:#8a87a0;
        }
        input,button,textarea{font-family:'IBM Plex Mono',monospace}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:var(--bg2)}
        ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fade-up{animation:fadeUp 0.25s ease forwards}
    `;
    document.head.appendChild(s);
};

export default function App() {
    injectStyles();

    const [page, setPage] = useState("market");
    const [buyTarget, setBuyTarget] = useState(null);
    const [toast, setToast] = useState({ msg: "", type: "" });

    const showToast = (msg, type = "info") => {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: "", type: "" }), 4500);
    };

    const handleConfirmBuy = async (property) => {
        try {
            const contract = await getContract();
            const tx = await contract.buyLicense(
                BigInt(property.id),
                BigInt(86400),
                { value: property.priceWei }
            );
            await tx.wait();
            showToast(`License purchased for Property #${property.id}!`, "success");
        } catch (e) {
            alert("Transaction failed: " + e.message);
            throw e;
        }
    };

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
            {/* Header Navigation */}
            <Navbar activePage={page} onSelectPage={(p) => setPage(p)} />

            {/* Main Content Area */}
            <main style={{ maxWidth: 1150, margin: "0 auto", padding: "40px 24px 100px" }}>
                {page === "market" && <Marketplace onBuy={(p) => setBuyTarget(p)} />}
                {page === "register" && (
                    <Register
                        onRegistered={() => {}}
                        showToast={showToast}
                    />
                )}
                {page === "verify" && <VerifyIP />}
                {page === "licenses" && <MyLicenses />}
                {page === "shares" && <Shares />}
                {page === "pricing" && <Pricing />}
            </main>

            {/* On-Chain License Purchase Modal */}
            {buyTarget && (
                <BuyModal
                    property={buyTarget}
                    onClose={() => setBuyTarget(null)}
                    onConfirm={handleConfirmBuy}
                />
            )}

            {/* Global Alert Toast */}
            <Toast msg={toast.msg} type={toast.type} />
        </div>
    );
}
