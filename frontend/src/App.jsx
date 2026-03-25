import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { contractAddress, contractABI } from "./contract";

/* ================================================================
   GLOBAL STYLES
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
        input,button{font-family:'IBM Plex Mono',monospace}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:var(--bg2)}
        ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .fade-up{animation:fadeUp 0.3s ease forwards}
    `;
    document.head.appendChild(s);
};

/* ================================================================
   CONTRACT / IPFS HELPERS
================================================================ */
const MAX_FILE_MB = 5;

const uploadToIPFS = async (file, onProgress) => {
    if (file.size > MAX_FILE_MB * 1024 * 1024)
        throw new Error(`File too large. Max ${MAX_FILE_MB}MB.`);
    const formData = new FormData();
    formData.append("file", file);
    const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS", formData,
        {
            headers: { Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}` },
            timeout: 30000,
            onUploadProgress: e => onProgress?.(Math.round(e.loaded * 100 / e.total))
        }
    );
    if (!res.data?.IpfsHash) throw new Error("Pinata error — check VITE_PINATA_JWT");
    return res.data.IpfsHash;
};

const getProvider  = ()  => new ethers.BrowserProvider(window.ethereum);
const getSigner    = async () => { await window.ethereum.request({method:"eth_requestAccounts"}); return getProvider().getSigner(); };
const getContract  = async () => { const s = await getSigner(); return new ethers.Contract(contractAddress, contractABI, s); };
const getAddress   = async () => (await getSigner()).getAddress();
const fmt          = w   => parseFloat(ethers.formatEther(w)).toFixed(4);
const short        = a   => a ? `${a.slice(0,6)}…${a.slice(-4)}` : "";

const BASE=0.01, INC=0.001, CAP=10;
const priceAt = sold => parseFloat((BASE + INC*(Math.min(Math.floor(sold/10)+1,CAP)-1)).toFixed(4));
const CURVE   = Array.from({length:11},(_,i)=>({sales:i*10,price:priceAt(i*10)}));

/* ================================================================
   UI PRIMITIVES
================================================================ */
const css = {
    card: {background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:16,padding:24,transition:"border-color .2s"},
    cardHover: {borderColor:"var(--border2)"},
    btn: (variant="primary",disabled=false) => ({
        fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:500,
        padding:"10px 20px",borderRadius:8,border:"none",cursor:disabled?"not-allowed":"pointer",
        letterSpacing:"0.02em",transition:"all .15s",opacity:disabled?0.5:1,
        ...(variant==="primary"   ? {background:"var(--accent)",color:"#fff"} :
            variant==="success"   ? {background:"var(--green)",color:"#07070f",fontWeight:600} :
                variant==="danger"    ? {background:"transparent",color:"var(--red)",border:"1px solid var(--red)"} :
                    variant==="ghost"     ? {background:"transparent",color:"var(--muted2)",border:"1px solid var(--border)"} :
                        {background:"transparent",color:"var(--text)",border:"1px solid var(--border)"})
    }),
    input: {fontFamily:"'IBM Plex Mono',monospace",fontSize:13,background:"var(--bg3)",border:"1px solid var(--border)",
        color:"var(--text)",padding:"10px 14px",borderRadius:8,outline:"none",width:"100%"},
    label: {fontSize:11,fontWeight:500,color:"var(--muted2)",letterSpacing:"0.08em",
        textTransform:"uppercase",marginBottom:6,display:"block"},
    pill: (color="accent") => ({
        display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:500,
        padding:"3px 10px",borderRadius:20,
        ...(color==="green"  ? {background:"var(--green-dim)",color:"var(--green)",border:"1px solid rgba(0,212,170,.2)"} :
            color==="red"    ? {background:"var(--red-dim)",color:"var(--red)",border:"1px solid rgba(255,69,96,.2)"} :
                color==="amber"  ? {background:"var(--amber-dim)",color:"var(--amber)",border:"1px solid rgba(255,184,77,.2)"} :
                    {background:"rgba(108,71,255,.15)",color:"var(--accent)",border:"1px solid rgba(108,71,255,.25)"})
    }),
};

const Spinner = () => (
    <span style={{display:"inline-block",width:14,height:14,border:"2px solid var(--border2)",
        borderTopColor:"var(--accent)",borderRadius:"50%",animation:"spin .7s linear infinite"}} />
);

const Field = ({label, children, hint}) => (
    <div style={{marginBottom:18}}>
        <label style={css.label}>{label}</label>
        {children}
        {hint && <div style={{fontSize:11,color:"var(--muted)",marginTop:5}}>{hint}</div>}
    </div>
);

const Divider = () => <div style={{borderTop:"1px solid var(--border)",margin:"20px 0"}} />;

const Toast = ({msg, type}) => {
    if (!msg) return null;
    const color = type==="success"?"var(--green)":type==="error"?"var(--red)":"var(--muted2)";
    return (
        <div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",
            background:"var(--bg3)",border:`1px solid ${color}`,borderRadius:12,
            padding:"12px 20px",fontSize:13,maxWidth:520,width:"90%",
            display:"flex",alignItems:"center",gap:10,zIndex:999,
            boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>
            <span style={{color,fontSize:16}}>
                {type==="success"?"✓":type==="error"?"✕":"⟳"}
            </span>
            <span style={{color:"var(--text)",flex:1}}>{msg}</span>
        </div>
    );
};

/* ================================================================
   PAGE: MARKETPLACE
================================================================ */
function Marketplace({onBuy}) {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading]       = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const contract = await getContract();
                const count    = Number(await contract.propertyCounter());
                const items    = [];
                for (let i = 0; i < count; i++) {
                    const prop  = await contract.properties(BigInt(i));
                    const price = await contract.getLicensePrice(BigInt(i));
                    const cid   = await contract.versionCids(BigInt(i), prop.currentVersion);
                    items.push({
                        id:       i,
                        version:  Number(prop.currentVersion),
                        sold:     Number(prop.licensesSold),
                        price:    fmt(price),
                        priceWei: price,
                        cid,
                        pool:     fmt(prop.revenuePool),
                    });
                }
                setProperties(items);
            } catch(e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    if (loading) return (
        <div style={{textAlign:"center",padding:80,color:"var(--muted)"}}>
            <Spinner /> <span style={{marginLeft:10}}>Loading marketplace…</span>
        </div>
    );

    if (!properties.length) return (
        <div style={{textAlign:"center",padding:80,color:"var(--muted)"}}>
            <div style={{fontSize:32,marginBottom:16}}>◻</div>
            <div style={{fontSize:14}}>No properties registered yet.</div>
            <div style={{fontSize:12,marginTop:6}}>Go to Register to add the first one.</div>
        </div>
    );

    return (
        <div>
            <div style={{marginBottom:24}}>
                <h2 style={{fontFamily:"Syne",fontSize:22,fontWeight:700,marginBottom:4}}>Marketplace</h2>
                <div style={{fontSize:12,color:"var(--muted)"}}>
                    {properties.length} registered {properties.length===1?"property":"properties"} · Buy a license to access any version
                </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
                {properties.map(p => (
                    <div key={p.id} className="fade-up" style={{
                        ...css.card,
                        borderRadius:14,padding:20,
                        display:"flex",flexDirection:"column",gap:14
                    }}>
                        {/* Header */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                            <div>
                                <div style={{fontFamily:"Syne",fontSize:16,fontWeight:700}}>
                                    Property #{p.id}
                                </div>
                                <div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>
                                    {p.cid.slice(0,18)}…
                                </div>
                            </div>
                            <span style={css.pill("accent")}>v{p.version}</span>
                        </div>

                        {/* IPFS link */}
                        <a href={`https://gateway.pinata.cloud/ipfs/${p.cid}`}
                           target="_blank" rel="noreferrer"
                           style={{fontSize:11,color:"var(--accent)",textDecoration:"none",
                               border:"1px solid var(--border)",borderRadius:6,padding:"5px 10px",
                               display:"block",textAlign:"center"}}>
                            View on IPFS ↗
                        </a>

                        {/* Stats */}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                            <div style={{background:"var(--bg3)",borderRadius:8,padding:"10px 12px"}}>
                                <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Price</div>
                                <div style={{fontSize:18,fontFamily:"Syne",fontWeight:700,color:"var(--green)",marginTop:2}}>
                                    {p.price} ETH
                                </div>
                            </div>
                            <div style={{background:"var(--bg3)",borderRadius:8,padding:"10px 12px"}}>
                                <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Licenses Sold</div>
                                <div style={{fontSize:18,fontFamily:"Syne",fontWeight:700,marginTop:2}}>
                                    {p.sold}
                                </div>
                            </div>
                        </div>

                        {/* Price note */}
                        <div style={{fontSize:11,color:"var(--muted)",background:"var(--bg3)",
                            borderRadius:6,padding:"6px 10px"}}>
                            Next price increase at {Math.ceil((p.sold+1)/10)*10} sales
                        </div>

                        {/* Buy */}
                        <button style={{...css.btn("success"),width:"100%",padding:"12px"}}
                                onClick={() => onBuy(p)}>
                            Buy License — {p.price} ETH
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ================================================================
   PAGE: REGISTER
================================================================ */
function Register({onRegistered}) {
    const [file, setFile]       = useState(null);
    const [pct, setPct]         = useState(null);
    const [busy, setBusy]       = useState(false);
    const [result, setResult]   = useState(null);

    const onFileChange = e => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > MAX_FILE_MB*1024*1024) { alert(`Max ${MAX_FILE_MB}MB`); return; }
        setFile(f);
    };

    const register = async () => {
        if (!file) return alert("Select a file first");
        setBusy(true); setResult(null);
        try {
            setPct(0);
            const cid      = await uploadToIPFS(file, p => setPct(p));
            setPct(null);
            const contract = await getContract();
            const tx       = await contract.registerProperty(cid);
            await tx.wait();
            const count = await contract.propertyCounter();
            const newId = Number(count)-1;
            const prop  = await contract.properties(BigInt(newId));
            setResult({id:newId, cid, shareToken:prop.shareToken});
            onRegistered?.();
        } catch(e) { alert("Error: "+e.message); }
        finally { setBusy(false); setPct(null); }
    };

    return (
        <div style={{maxWidth:520}}>
            <h2 style={{fontFamily:"Syne",fontSize:22,fontWeight:700,marginBottom:4}}>Register Property</h2>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:28}}>
                Upload your file to IPFS and mint it as an on-chain IP asset
            </div>

            <div style={{...css.card}}>
                <Field label="Select file" hint={`Max ${MAX_FILE_MB}MB · Any file type`}>
                    <div style={{border:"1.5px dashed var(--border2)",borderRadius:10,padding:28,
                        textAlign:"center",position:"relative",cursor:"pointer",
                        background: file?"rgba(108,71,255,.04)":"transparent"}}>
                        <input type="file" onChange={onFileChange}
                               style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}} />
                        {file ? (
                            <div>
                                <div style={{color:"var(--green)",fontSize:14,fontWeight:500}}>
                                    ✓ {file.name}
                                </div>
                                <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>
                                    {(file.size/1024).toFixed(1)} KB
                                </div>
                            </div>
                        ) : (
                            <div style={{color:"var(--muted)"}}>
                                <div style={{fontSize:24,marginBottom:8}}>↑</div>
                                <div style={{fontSize:13}}>Drop or click to select</div>
                            </div>
                        )}
                        {pct !== null && (
                            <div style={{marginTop:12,height:4,background:"var(--bg4)",borderRadius:2}}>
                                <div style={{height:"100%",width:`${pct}%`,
                                    background:"var(--accent)",borderRadius:2,transition:"width .3s"}} />
                            </div>
                        )}
                    </div>
                </Field>

                <button style={{...css.btn("primary",busy||!file),width:"100%",padding:12}}
                        onClick={register} disabled={busy||!file}>
                    {busy ? <><Spinner /> &nbsp;Processing…</> : "Upload to IPFS & Register"}
                </button>
            </div>

            {result && (
                <div className="fade-up" style={{...css.card,marginTop:16,borderColor:"var(--green)"}}>
                    <div style={{color:"var(--green)",fontSize:14,fontWeight:600,marginBottom:12}}>
                        ✓ Property registered successfully
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {[
                            ["Property ID", result.id],
                            ["Version", "v1"],
                            ["IPFS CID", result.cid],
                            ["Share Token", short(result.shareToken)],
                            ["Your Shares", "1000 / 1000 (100%)"],
                        ].map(([k,v]) => (
                            <div key={k} style={{display:"flex",justifyContent:"space-between",
                                fontSize:12,padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
                                <span style={{color:"var(--muted)"}}>{k}</span>
                                <span style={{color:"var(--text)",fontWeight:500}}>{String(v)}</span>
                            </div>
                        ))}
                    </div>
                    <a href={`https://gateway.pinata.cloud/ipfs/${result.cid}`}
                       target="_blank" rel="noreferrer"
                       style={{display:"block",textAlign:"center",marginTop:14,fontSize:12,
                           color:"var(--accent)",textDecoration:"none"}}>
                        View file on IPFS ↗
                    </a>
                </div>
            )}
        </div>
    );
}

/* ================================================================
   PAGE: MY LICENSES
================================================================ */
function MyLicenses() {
    const [propertyId, setPropertyId] = useState("");
    const [licInfo, setLicInfo]       = useState(null);
    const [vCheck, setVCheck]         = useState(null);
    const [busy, setBusy]             = useState(false);
    const [updateFile, setUpdateFile] = useState(null);
    const [updating, setUpdating]     = useState(false);
    const [currentVer, setCurrentVer] = useState(null);

    const check = async () => {
        if (!propertyId) return;
        setBusy(true);
        try {
            const contract = await getContract();
            const myAddr   = await getAddress();
            const [ver,expiry,active,sharesBacked] =
                await contract.getLicenseInfo(BigInt(propertyId), myAddr);
            const valid    = await contract.isLicenseValid(BigInt(propertyId), myAddr);
            const cvr      = await contract.getCurrentVersion(BigInt(propertyId));
            setCurrentVer(Number(cvr));

            // version lock check for all versions
            const results = [];
            for (let v=1; v<=Number(cvr); v++) {
                const ok = await contract.isLicenseValidForVersion(BigInt(propertyId),myAddr,BigInt(v));
                results.push({version:v, valid:ok});
            }
            setLicInfo({valid,version:Number(ver),active,sharesBacked:Number(sharesBacked),
                expiry:Number(expiry)===0?"Not set":new Date(Number(expiry)*1000).toLocaleString()});
            setVCheck(results);
        } catch(e) { alert("Error: "+e.message); }
        finally { setBusy(false); }
    };

    const update = async () => {
        if (!updateFile || !propertyId) return;
        setUpdating(true);
        try {
            const cid      = await uploadToIPFS(updateFile);
            const contract = await getContract();
            const tx       = await contract.updateProperty(BigInt(propertyId), cid);
            await tx.wait();
            const ver = await contract.getCurrentVersion(BigInt(propertyId));
            setCurrentVer(Number(ver));
            setVCheck(null); setLicInfo(null);
            alert(`Updated to v${Number(ver)}`);
        } catch(e) { alert("Error: "+e.message); }
        finally { setUpdating(false); }
    };

    return (
        <div style={{maxWidth:560}}>
            <h2 style={{fontFamily:"Syne",fontSize:22,fontWeight:700,marginBottom:4}}>My Licenses</h2>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:28}}>
                Check which versions you have access to and manage your properties
            </div>

            <div style={{...css.card,marginBottom:16}}>
                <Field label="Property ID">
                    <div style={{display:"flex",gap:8}}>
                        <input style={css.input} type="number" placeholder="e.g. 0"
                               value={propertyId} onChange={e=>setPropertyId(e.target.value)} />
                        <button style={{...css.btn("primary",busy||!propertyId),whiteSpace:"nowrap",padding:"10px 16px"}}
                                onClick={check} disabled={busy||!propertyId}>
                            {busy?<Spinner/>:"Check"}
                        </button>
                    </div>
                </Field>
                {currentVer !== null && (
                    <div style={{fontSize:12,color:"var(--muted)",marginTop:-8}}>
                        Current on-chain version: <span style={{color:"var(--amber)",fontWeight:500}}>v{currentVer}</span>
                    </div>
                )}
            </div>

            {licInfo && (
                <div className="fade-up" style={{...css.card,marginBottom:16}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:14,
                        color:licInfo.valid?"var(--green)":"var(--red)"}}>
                        {licInfo.valid ? "✓ License Active" : "✕ No Active License"}
                    </div>
                    {[
                        ["Issued for version", `v${licInfo.version}`],
                        ["Status", licInfo.active?"Active":"Inactive"],
                        ["Expires", licInfo.expiry],
                        ["Shares-backed", licInfo.sharesBacked>0?`Yes (${licInfo.sharesBacked} shares)`:"No"],
                    ].map(([k,v]) => (
                        <div key={k} style={{display:"flex",justifyContent:"space-between",
                            fontSize:12,padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                            <span style={{color:"var(--muted)"}}>{k}</span>
                            <span style={{color:"var(--text)"}}>{v}</span>
                        </div>
                    ))}
                </div>
            )}

            {vCheck && vCheck.length > 0 && (
                <div className="fade-up" style={{...css.card,marginBottom:16}}>
                    <div style={{fontSize:12,fontWeight:600,color:"var(--muted2)",
                        textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:14}}>
                        Version Access Check
                    </div>
                    <div style={{fontSize:11,color:"var(--muted)",marginBottom:12}}>
                        Your license is locked to the version you bought. Updating the property does not upgrade your license.
                    </div>
                    {vCheck.map(({version,valid}) => (
                        <div key={version} style={{
                            display:"flex",alignItems:"center",gap:14,
                            padding:"12px 14px",borderRadius:10,marginBottom:8,
                            background:valid?"rgba(0,212,170,.06)":"rgba(255,69,96,.06)",
                            border:`1px solid ${valid?"rgba(0,212,170,.2)":"rgba(255,69,96,.2)"}`
                        }}>
                            <div style={{fontSize:18}}>{valid?"✓":"✕"}</div>
                            <div style={{flex:1}}>
                                <div style={{fontSize:13,fontWeight:600,
                                    color:valid?"var(--green)":"var(--red)"}}>
                                    Version {version}
                                </div>
                                <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>
                                    {valid
                                        ? "You have valid access to this version"
                                        : "Not licensed — you need to buy a new license for this version"}
                                </div>
                            </div>
                            <span style={css.pill(valid?"green":"red")}>
                                {valid?"VALID":"LOCKED OUT"}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <Divider />

            {/* Update property section for owners */}
            <div style={{...css.card}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Update Property (Owner Only)</div>
                <div style={{fontSize:11,color:"var(--muted)",marginBottom:14}}>
                    Upload a new version. All existing licenses stay locked to their original version.
                </div>
                <Field label="New file">
                    <input type="file" onChange={e=>setUpdateFile(e.target.files[0])}
                           style={{...css.input,padding:"8px"}} />
                </Field>
                <button style={{...css.btn("ghost",updating||!updateFile||!propertyId),width:"100%"}}
                        onClick={update} disabled={updating||!updateFile||!propertyId}>
                    {updating?<><Spinner/> &nbsp;Updating…</>:"Update → New IPFS + Bump version"}
                </button>
            </div>
        </div>
    );
}

/* ================================================================
   PAGE: SHARES & REVENUE
================================================================ */
function Shares() {
    const [propertyId, setPropertyId]   = useState("");
    const [myShares, setMyShares]       = useState(null);
    const [recipient, setRecipient]     = useState("");
    const [amount, setAmount]           = useState("");
    const [revenue, setRevenue]         = useState(null);
    const [shareToken, setShareToken]   = useState("");
    const [busy, setBusy]               = useState("");

    const loadShares = async () => {
        if (!propertyId) return;
        setBusy("loading");
        try {
            const contract = await getContract();
            const myAddr   = await getAddress();
            const bal      = await contract.getShareBalance(BigInt(propertyId), myAddr);
            const prop     = await contract.properties(BigInt(propertyId));
            setMyShares(Number(bal));
            setShareToken(prop.shareToken);
        } catch(e) { alert("Error: "+e.message); }
        finally { setBusy(""); }
    };

    const transferShares = async () => {
        if (!propertyId||!recipient||!amount) return;
        setBusy("transfer");
        try {
            const contract = await getContract();
            const token    = shareToken || await contract.getShareToken(BigInt(propertyId));
            const signer   = await getSigner();
            const erc20    = new ethers.Contract(token,["function approve(address,uint256) returns(bool)"],signer);
            await (await erc20.approve(contractAddress, BigInt(amount))).wait();
            await (await contract.transferShares(BigInt(propertyId), recipient, BigInt(amount))).wait();
            await loadShares();
            setRecipient(""); setAmount("");
            alert(`✓ ${amount} shares transferred to ${short(recipient)}`);
        } catch(e) { alert("Error: "+e.message); }
        finally { setBusy(""); }
    };

    const claimShareLicense = async () => {
        if (!propertyId) return;
        setBusy("claimLic");
        try {
            const contract = await getContract();
            await (await contract.claimShareHolderLicense(BigInt(propertyId), BigInt(86400))).wait();
            alert("✓ Free license claimed via share ownership!");
        } catch(e) { alert("Error: "+e.message); }
        finally { setBusy(""); }
    };

    const checkRevenue = async () => {
        if (!propertyId) return;
        setBusy("revenue");
        try {
            const contract = await getContract();
            const myAddr   = await getAddress();
            const claimable= await contract.claimableRevenue(BigInt(propertyId), myAddr);
            const prop     = await contract.properties(BigInt(propertyId));
            setRevenue({claimable:fmt(claimable), pool:fmt(prop.revenuePool)});
        } catch(e) { alert("Error: "+e.message); }
        finally { setBusy(""); }
    };

    const withdrawRevenue = async () => {
        if (!propertyId) return;
        setBusy("withdraw");
        try {
            const contract = await getContract();
            await (await contract.withdrawRevenue(BigInt(propertyId))).wait();
            setRevenue(null);
            alert("✓ Revenue withdrawn to your wallet!");
        } catch(e) { alert("Error: "+e.message); }
        finally { setBusy(""); }
    };

    const pct = myShares !== null ? ((myShares/1000)*100).toFixed(1) : null;

    return (
        <div style={{maxWidth:560}}>
            <h2 style={{fontFamily:"Syne",fontSize:22,fontWeight:700,marginBottom:4}}>Shares & Revenue</h2>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:28}}>
                Fractional ownership of IP assets · Earn proportional revenue from every license sale
            </div>

            {/* Property ID + load */}
            <div style={{...css.card,marginBottom:16}}>
                <Field label="Property ID">
                    <div style={{display:"flex",gap:8}}>
                        <input style={css.input} type="number" placeholder="e.g. 0"
                               value={propertyId} onChange={e=>{setPropertyId(e.target.value);setMyShares(null);setRevenue(null);}} />
                        <button style={{...css.btn("primary",busy==="loading"||!propertyId),padding:"10px 16px",whiteSpace:"nowrap"}}
                                onClick={loadShares} disabled={busy==="loading"||!propertyId}>
                            {busy==="loading"?<Spinner/>:"Load"}
                        </button>
                    </div>
                </Field>

                {myShares !== null && (
                    <div className="fade-up">
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <span style={{fontSize:12,color:"var(--muted)"}}>Your share balance</span>
                            <span style={css.pill("accent")}>{pct}% ownership</span>
                        </div>
                        <div style={{fontSize:28,fontFamily:"Syne",fontWeight:700,marginBottom:8}}>
                            {myShares} <span style={{fontSize:14,color:"var(--muted)",fontFamily:"'IBM Plex Mono'"}}>/ 1000 shares</span>
                        </div>
                        <div style={{height:6,background:"var(--bg4)",borderRadius:3}}>
                            <div style={{height:"100%",width:`${pct}%`,background:"var(--accent)",borderRadius:3,transition:"width .5s"}} />
                        </div>
                        <div style={{fontSize:11,color:"var(--muted)",marginTop:6}}>
                            Share token: {short(shareToken)}
                        </div>
                        <button style={{...css.btn("ghost",busy==="claimLic"),marginTop:12,width:"100%",fontSize:12}}
                                onClick={claimShareLicense} disabled={busy==="claimLic"||myShares===0}>
                            {busy==="claimLic"?<Spinner/>:"Claim Free Shareholder License"}
                        </button>
                    </div>
                )}
            </div>

            {/* Transfer */}
            <div style={{...css.card,marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Transfer Shares</div>
                <div style={{fontSize:11,color:"var(--muted)",marginBottom:14}}>
                    Send shares to Account 2 to simulate fractional co-ownership. Requires 2 MetaMask confirmations.
                </div>
                <Field label="Recipient address">
                    <input style={css.input} placeholder="0x…"
                           value={recipient} onChange={e=>setRecipient(e.target.value)} />
                </Field>
                <Field label="Amount of shares" hint="You start with 1000. Try transferring 300.">
                    <input style={css.input} type="number" placeholder="e.g. 300"
                           value={amount} onChange={e=>setAmount(e.target.value)} />
                </Field>
                <button style={{...css.btn("primary",busy==="transfer"||!recipient||!amount),width:"100%"}}
                        onClick={transferShares} disabled={busy==="transfer"||!recipient||!amount}>
                    {busy==="transfer"?<><Spinner/> &nbsp;Approving + Transferring…</>:"Transfer Shares"}
                </button>
            </div>

            {/* Revenue */}
            <div style={{...css.card}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Revenue from License Sales</div>
                <div style={{fontSize:11,color:"var(--muted)",marginBottom:14}}>
                    Every license purchase goes into the revenue pool. Each share holder withdraws their proportional cut.
                    Switch MetaMask accounts to check each holder's share.
                </div>
                <button style={{...css.btn("ghost",busy==="revenue"||!propertyId),width:"100%",marginBottom:12}}
                        onClick={checkRevenue} disabled={busy==="revenue"||!propertyId}>
                    {busy==="revenue"?<Spinner/>:"Check My Claimable Revenue"}
                </button>
                {revenue && (
                    <div className="fade-up" style={{background:"var(--bg3)",borderRadius:10,padding:16}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                            <div>
                                <div style={{fontSize:11,color:"var(--muted)"}}>Total Pool</div>
                                <div style={{fontSize:20,fontFamily:"Syne",fontWeight:700}}>{revenue.pool} ETH</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                                <div style={{fontSize:11,color:"var(--muted)"}}>Your Share</div>
                                <div style={{fontSize:20,fontFamily:"Syne",fontWeight:700,color:"var(--green)"}}>
                                    {revenue.claimable} ETH
                                </div>
                            </div>
                        </div>
                        {parseFloat(revenue.claimable)>0 ? (
                            <button style={{...css.btn("success",busy==="withdraw"),width:"100%"}}
                                    onClick={withdrawRevenue} disabled={busy==="withdraw"}>
                                {busy==="withdraw"?<Spinner/>:`Withdraw ${revenue.claimable} ETH`}
                            </button>
                        ) : (
                            <div style={{fontSize:11,color:"var(--muted)",textAlign:"center",padding:6}}>
                                Nothing to withdraw yet — buy licenses first to generate revenue
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ================================================================
   PAGE: DASHBOARD (dynamic pricing visual)
================================================================ */
function Dashboard() {
    const [propertyId, setPropertyId] = useState("");
    const [price, setPrice]           = useState(null);
    const [sold, setSold]             = useState(null);
    const [history, setHistory]       = useState([]);
    const [buying, setBuying]         = useState(false);

    const load = async () => {
        if (!propertyId) return;
        try {
            const contract  = await getContract();
            const [p, prop] = await Promise.all([
                contract.getLicensePrice(BigInt(propertyId)),
                contract.properties(BigInt(propertyId))
            ]);
            setPrice(fmt(p));
            setSold(Number(prop.licensesSold));
        } catch(e) { alert("Error: "+e.message); }
    };

    const buy = async () => {
        if (!propertyId) return;
        setBuying(true);
        try {
            const contract = await getContract();
            const p        = await contract.getLicensePrice(BigInt(propertyId));
            const tx       = await contract.buyLicense(BigInt(propertyId), BigInt(86400), {value:p});
            await tx.wait();
            const [newP, prop] = await Promise.all([
                contract.getLicensePrice(BigInt(propertyId)),
                contract.properties(BigInt(propertyId))
            ]);
            const newSold = Number(prop.licensesSold);
            setPrice(fmt(newP));
            setSold(newSold);
            setHistory(prev => [...prev, {sold:newSold, price:parseFloat(fmt(p))}]);
        } catch(e) { alert("Error: "+e.message); }
        finally { setBuying(false); }
    };

    const maxH = 100;
    const maxP = 0.1;

    return (
        <div style={{maxWidth:640}}>
            <h2 style={{fontFamily:"Syne",fontSize:22,fontWeight:700,marginBottom:4}}>Pricing Dashboard</h2>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:28}}>
                Demand-based pricing · Price rises automatically every 10 licenses sold · Capped at 0.1 ETH
            </div>

            {/* Property ID */}
            <div style={{...css.card,marginBottom:16}}>
                <Field label="Property ID">
                    <div style={{display:"flex",gap:8}}>
                        <input style={css.input} type="number" placeholder="e.g. 0"
                               value={propertyId} onChange={e=>{setPropertyId(e.target.value);setPrice(null);setSold(null);setHistory([]);}} />
                        <button style={{...css.btn("ghost",!propertyId),padding:"10px 16px",whiteSpace:"nowrap"}}
                                onClick={load} disabled={!propertyId}>
                            Load
                        </button>
                    </div>
                </Field>

                {/* Live stats */}
                {price !== null && (
                    <div className="fade-up" style={{display:"flex",gap:12,marginTop:4}}>
                        <div style={{flex:1,background:"var(--bg3)",borderRadius:10,padding:"14px 16px"}}>
                            <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Current Price</div>
                            <div style={{fontSize:28,fontFamily:"Syne",fontWeight:800,color:"var(--green)",marginTop:4}}>{price} ETH</div>
                        </div>
                        <div style={{flex:1,background:"var(--bg3)",borderRadius:10,padding:"14px 16px"}}>
                            <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Licenses Sold</div>
                            <div style={{fontSize:28,fontFamily:"Syne",fontWeight:800,marginTop:4}}>{sold}</div>
                        </div>
                        <div style={{flex:1,background:"var(--bg3)",borderRadius:10,padding:"14px 16px"}}>
                            <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Next Rise At</div>
                            <div style={{fontSize:28,fontFamily:"Syne",fontWeight:800,color:"var(--amber)",marginTop:4}}>
                                {Math.ceil((sold+1)/10)*10}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Buy button */}
            {price !== null && (
                <button style={{...css.btn("success",buying),width:"100%",padding:14,
                    fontSize:14,marginBottom:16,letterSpacing:"0.04em"}}
                        onClick={buy} disabled={buying}>
                    {buying ? <><Spinner/> &nbsp;Processing…</> : `Buy License — ${price} ETH`}
                </button>
            )}

            {/* Session purchase history chart */}
            {history.length > 0 && (
                <div className="fade-up" style={{...css.card,marginBottom:16}}>
                    <div style={{fontSize:12,color:"var(--muted2)",fontWeight:600,marginBottom:4,
                        textTransform:"uppercase",letterSpacing:"0.06em"}}>
                        Your purchases this session
                    </div>
                    <div style={{fontSize:11,color:"var(--muted)",marginBottom:16}}>
                        Each bar = one purchase. Bar height = price paid. Watch it climb.
                    </div>
                    <div style={{display:"flex",alignItems:"flex-end",gap:6,height:maxH+24,paddingBottom:20,
                        borderBottom:"1px solid var(--border)",position:"relative"}}>
                        {history.map((h,i) => (
                            <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                                <div style={{fontSize:9,color:"var(--muted)"}}>{h.price}Ξ</div>
                                <div style={{
                                    width:32, borderRadius:"4px 4px 0 0",
                                    height:`${(h.price/maxP)*maxH}px`,
                                    background:`hsl(${260-i*8},70%,60%)`,
                                    minHeight:4, transition:"height .4s ease"
                                }} />
                                <div style={{fontSize:9,color:"var(--muted)"}}>#{h.sold}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{fontSize:10,color:"var(--muted)",marginTop:8}}>
                        # = total licenses sold at time of purchase
                    </div>
                </div>
            )}

            {/* Full price curve */}
            <div style={{...css.card}}>
                <div style={{fontSize:12,color:"var(--muted2)",fontWeight:600,marginBottom:4,
                    textTransform:"uppercase",letterSpacing:"0.06em"}}>
                    Full price curve
                </div>
                <div style={{fontSize:11,color:"var(--muted)",marginBottom:16}}>
                    Formula: 0.01 ETH + 0.001 ETH × floor(sold ÷ 10) · Capped at 0.1 ETH after 100 sales
                </div>
                <div style={{display:"flex",alignItems:"flex-end",gap:4,height:maxH+30,paddingBottom:22,
                    borderBottom:"1px solid var(--border)"}}>
                    {CURVE.map((c,i) => (
                        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                            <div style={{fontSize:9,color:"var(--muted)"}}>
                                {c.price}Ξ
                            </div>
                            <div style={{
                                width:"100%",borderRadius:"3px 3px 0 0",
                                height:`${(c.price/maxP)*maxH}px`,
                                background: i===0?"var(--green)":i===CURVE.length-1?"var(--red)":"var(--accent)",
                                opacity: 0.4+i*0.06, minHeight:4
                            }} />
                            <div style={{fontSize:9,color:"var(--muted)"}}>{c.sales}</div>
                        </div>
                    ))}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--muted)",marginTop:8}}>
                    <span style={{color:"var(--green)"}}>■ Start: 0.01 ETH</span>
                    <span>X axis = total licenses sold</span>
                    <span style={{color:"var(--red)"}}>■ Cap: 0.1 ETH</span>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   BUY MODAL
================================================================ */
function BuyModal({property, onClose, onDone}) {
    const [buying, setBuying] = useState(false);

    const buy = async () => {
        setBuying(true);
        try {
            const contract = await getContract();
            const tx = await contract.buyLicense(
                BigInt(property.id), BigInt(86400), {value: property.priceWei}
            );
            await tx.wait();
            onDone?.();
            onClose();
        } catch(e) { alert("Error: "+e.message); }
        finally { setBuying(false); }
    };

    return (
        <div style={{position:"fixed",inset:0,background:"rgba(7,7,15,.85)",
            display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
            <div style={{...css.card,width:380,borderColor:"var(--border2)"}}>
                <div style={{fontFamily:"Syne",fontSize:18,fontWeight:700,marginBottom:4}}>
                    Buy License
                </div>
                <div style={{fontSize:12,color:"var(--muted)",marginBottom:20}}>
                    Your license will be locked to the current version of this property.
                </div>
                {[
                    ["Property", `#${property.id}`],
                    ["Current Version", `v${property.version}`],
                    ["Your license locked to", `v${property.version}`],
                    ["Price", `${property.price} ETH`],
                    ["Duration", "1 day"],
                ].map(([k,v]) => (
                    <div key={k} style={{display:"flex",justifyContent:"space-between",
                        fontSize:12,padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                        <span style={{color:"var(--muted)"}}>{k}</span>
                        <span style={{color:k==="Price"?"var(--green)":k.includes("locked")?"var(--amber)":"var(--text)",fontWeight:500}}>{v}</span>
                    </div>
                ))}
                <div style={{fontSize:11,color:"var(--muted)",marginTop:12,padding:"8px 10px",
                    background:"var(--bg3)",borderRadius:6}}>
                    If this property updates to v{property.version+1} later, you will NOT have access to it.
                    Version lock is enforced on-chain.
                </div>
                <div style={{display:"flex",gap:10,marginTop:16}}>
                    <button style={{...css.btn("ghost"),flex:1}} onClick={onClose}>Cancel</button>
                    <button style={{...css.btn("success",buying),flex:2}} onClick={buy} disabled={buying}>
                        {buying?<><Spinner/> &nbsp;Confirm in MetaMask…</>:`Confirm — ${property.price} ETH`}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   ROOT APP
================================================================ */
function App() {

    injectStyles();

    const [page, setPage]         = useState("market");
    const [buyTarget, setBuyTarget] = useState(null);
    const [toast, setToast]       = useState({msg:"",type:""});

    const showToast = (msg, type="info") => {
        setToast({msg,type});
        setTimeout(() => setToast({msg:"",type:""}), 4000);
    };

    const NAV = [
        {id:"market",  label:"Marketplace"},
        {id:"register",label:"Register"},
        {id:"licenses",label:"My Licenses"},
        {id:"shares",  label:"Shares"},
        {id:"pricing", label:"Pricing"},
    ];

    return (
        <div style={{minHeight:"100vh",background:"var(--bg)"}}>

            {/* HEADER */}
            <div style={{borderBottom:"1px solid var(--border)",background:"var(--bg2)",
                position:"sticky",top:0,zIndex:100}}>
                <div style={{maxWidth:1100,margin:"0 auto",padding:"0 24px",
                    display:"flex",alignItems:"center",justifyContent:"space-between",height:60}}>

                    {/* Logo */}
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:28,height:28,background:"var(--accent)",borderRadius:6,
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:14,fontWeight:700,color:"#fff",fontFamily:"Syne"}}>
                            C
                        </div>
                        <div>
                            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:15,letterSpacing:"-0.02em"}}>
                                ChainLicense
                            </div>
                            <div style={{fontSize:9,color:"var(--muted)",letterSpacing:"0.06em",
                                textTransform:"uppercase",marginTop:-1}}>
                                Decentralised IP Registry
                            </div>
                        </div>
                    </div>

                    {/* Nav */}
                    <div style={{display:"flex",gap:4}}>
                        {NAV.map(n => (
                            <button key={n.id}
                                    onClick={() => setPage(n.id)}
                                    style={{
                                        fontFamily:"'IBM Plex Mono',monospace",
                                        fontSize:12,padding:"6px 14px",borderRadius:7,
                                        border:"none",cursor:"pointer",transition:"all .15s",
                                        background: page===n.id?"var(--bg4)":"transparent",
                                        color: page===n.id?"var(--text)":"var(--muted)",
                                        borderBottom: page===n.id?"2px solid var(--accent)":"2px solid transparent",
                                    }}>
                                {n.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* MAIN */}
            <div style={{maxWidth:1100,margin:"0 auto",padding:"40px 24px 100px"}}>
                {page==="market"   && <Marketplace onBuy={p=>setBuyTarget(p)} />}
                {page==="register" && <Register onRegistered={()=>showToast("Property registered!","success")} />}
                {page==="licenses" && <MyLicenses />}
                {page==="shares"   && <Shares />}
                {page==="pricing"  && <Dashboard />}
            </div>

            {/* BUY MODAL */}
            {buyTarget && (
                <BuyModal
                    property={buyTarget}
                    onClose={()=>setBuyTarget(null)}
                    onDone={()=>showToast("License purchased!","success")}
                />
            )}

            {/* TOAST */}
            <Toast msg={toast.msg} type={toast.type} />
        </div>
    );


}
export default App;