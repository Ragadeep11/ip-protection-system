// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
IP Lifecycle System - v2

New Features:
1. Fractional License Ownership (ERC20-style shares per property)
2. Dynamic Pricing (demand-based price curve)
3. Version-bound licensing (v1 license locked to v1)
4. Expiry-based license
5. Share-based revenue distribution
6. License transfer between share holders
*/

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/* ============================================================
   LICENSE SHARE TOKEN
   One deployed per property — represents fractional ownership
   of that property's license rights.
   ============================================================ */
contract LicenseShareToken is ERC20 {

    address public immutable registry;   // IPRegistry address
    uint256 public immutable propertyId;

    modifier onlyRegistry() {
        require(msg.sender == registry, "Only registry");
        _;
    }

    constructor(
        uint256 _propertyId,
        address _registry,
        address _owner,
        uint256 _initialSupply
    ) ERC20(
    string(abi.encodePacked("IPShare-", _uint2str(_propertyId))),
    string(abi.encodePacked("IPS-",    _uint2str(_propertyId)))
    ) {
        registry   = _registry;
        propertyId = _propertyId;
        _mint(_owner, _initialSupply);
    }

    /* Registry can mint more shares (e.g. if owner splits further) */
    function mint(address to, uint256 amount) external onlyRegistry {
        _mint(to, amount);
    }

    /* Registry can burn shares (e.g. on buyout) */
    function burn(address from, uint256 amount) external onlyRegistry {
        _burn(from, amount);
    }

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v;
        uint256 digits;
        while (tmp != 0) { digits++; tmp /= 10; }
        bytes memory buf = new bytes(digits);
        while (v != 0) { digits--; buf[digits] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }
}

/* ============================================================
   MAIN REGISTRY
   ============================================================ */
contract IPRegistry is ERC721 {

    /* ---- constants ---- */
    uint256 public constant TOTAL_SHARES      = 1000;   // shares per property
    uint256 public constant BASE_LICENSE_FEE  = 0.01 ether;
    uint256 public constant PRICE_INCREMENT   = 0.001 ether; // per 10 licenses sold
    uint256 public constant MAX_PRICE_MULT    = 10;     // price never exceeds 10x base

    /* ---- state ---- */
    uint256 public propertyCounter;

    struct Property {
        uint256 currentVersion;
        uint256 licensesSold;          // drives dynamic price
        address shareToken;            // ERC20 share contract
        uint256 revenuePool;           // ETH accumulated for share holders
        bytes32 contentHash;           // cryptographic fingerprint of content/image
        uint256 blockNumber;           // block number where patent was minted
        uint256 registrationTimestamp; // timestamp when asset was patented
        string  title;                 // title registered in the block
    }

    struct License {
        uint256 version;   // version at time of purchase — LOCKED
        uint256 expiry;
        bool    active;
        uint256 sharesBacked; // >0 if the license is backed by share ownership
    }

    mapping(uint256 => Property)                          public properties;
    mapping(uint256 => mapping(uint256 => string))        public versionCids;
    mapping(uint256 => mapping(address => License))       public licenses;

    // IP Protection & Anti-Copying mappings (prevents duplicate image/asset registration)
    mapping(string => bool)                               public isCidRegistered;
    mapping(string => uint256)                            public cidToPropertyId;
    mapping(bytes32 => bool)                              public isContentHashRegistered;
    mapping(bytes32 => uint256)                           public contentHashToPropertyId;

    /* ---- events ---- */
    event PropertyRegistered(uint256 indexed id, address indexed owner, address shareToken);
    event PropertyRegisteredWithHash(uint256 indexed id, address indexed owner, address shareToken, bytes32 contentHash);
    event PropertyUpdated(uint256 indexed id, uint256 newVersion);
    event LicensePurchased(uint256 indexed id, address indexed user, uint256 price, uint256 version);
    event LicenseGranted(uint256 indexed id, address indexed user, uint256 version);
    event LicenseRevoked(uint256 indexed id, address indexed user);
    event RevenueWithdrawn(uint256 indexed id, address indexed holder, uint256 amount);
    event SharesTransferred(uint256 indexed id, address from, address to, uint256 amount);

    constructor() ERC721("IPToken", "IPT") {}

    /* ============================================================
       1. REGISTER PROPERTY (Enforces unique CID and unique contentHash)
       ============================================================ */
    function registerProperty(string memory cid) public {
        registerPropertyWithDetails(cid, bytes32(0), "");
    }

    function registerPropertyWithHash(string memory cid, bytes32 contentHash) public {
        registerPropertyWithDetails(cid, contentHash, "");
    }

    function registerPropertyWithDetails(string memory cid, bytes32 contentHash, string memory title) public {
        require(bytes(cid).length > 0, "CID cannot be empty");
        require(!isCidRegistered[cid], "IP Protection: Asset with this image/CID is already patented on-chain!");
        if (contentHash != bytes32(0)) {
            require(!isContentHashRegistered[contentHash], "IP Protection: Asset with this content hash is already patented on-chain!");
            isContentHashRegistered[contentHash] = true;
            contentHashToPropertyId[contentHash] = propertyCounter;
        }

        uint256 id = propertyCounter;
        _mint(msg.sender, id);

        // Deploy a share token for this property
        LicenseShareToken shareToken = new LicenseShareToken(
            id,
            address(this),
            msg.sender,
            TOTAL_SHARES
        );

        properties[id] = Property({
            currentVersion: 1,
            licensesSold:   0,
            shareToken:     address(shareToken),
            revenuePool:    0,
            contentHash:    contentHash,
            blockNumber:    block.number,
            registrationTimestamp: block.timestamp,
            title:          title
        });

        versionCids[id][1] = cid;
        isCidRegistered[cid] = true;
        cidToPropertyId[cid] = id;

        emit PropertyRegistered(id, msg.sender, address(shareToken));
        if (contentHash != bytes32(0)) {
            emit PropertyRegisteredWithHash(id, msg.sender, address(shareToken), contentHash);
        }
        propertyCounter++;
    }

    /* ============================================================
       2. UPDATE PROPERTY (version bump — existing licenses stay locked)
       ============================================================ */
    function updateProperty(uint256 id, string memory newCid) public {
        updatePropertyWithHash(id, newCid, bytes32(0));
    }

    function updatePropertyWithHash(uint256 id, string memory newCid, bytes32 newContentHash) public {
        require(ownerOf(id) == msg.sender, "Not owner");
        require(bytes(newCid).length > 0, "New CID cannot be empty");
        require(!isCidRegistered[newCid], "IP Protection: New CID already registered to another property");
        if (newContentHash != bytes32(0)) {
            require(!isContentHashRegistered[newContentHash], "IP Protection: New content hash already registered");
            isContentHashRegistered[newContentHash] = true;
            contentHashToPropertyId[newContentHash] = id;
            properties[id].contentHash = newContentHash;
        }

        properties[id].currentVersion += 1;
        uint256 newVersion = properties[id].currentVersion;
        versionCids[id][newVersion] = newCid;
        isCidRegistered[newCid] = true;
        cidToPropertyId[newCid] = id;

        emit PropertyUpdated(id, newVersion);
    }

    /* ============================================================
       3. DYNAMIC PRICING
       Price increases by PRICE_INCREMENT for every 10 licenses sold,
       capped at MAX_PRICE_MULT * BASE_LICENSE_FEE.
       ============================================================ */
    function getLicensePrice(uint256 id) public view returns (uint256) {
        uint256 steps = properties[id].licensesSold / 10;
        uint256 multiplier = steps + 1;
        if (multiplier > MAX_PRICE_MULT) multiplier = MAX_PRICE_MULT;
        return BASE_LICENSE_FEE + (PRICE_INCREMENT * (multiplier - 1));
    }

    /* ============================================================
       4. BUY LICENSE (pays ETH, version-locked, price is dynamic)
       ============================================================ */
    function buyLicense(uint256 id, uint256 duration) public payable {
        uint256 price = getLicensePrice(id);
        require(msg.value >= price, "Insufficient ETH");

        uint256 currentVer = properties[id].currentVersion;

        licenses[id][msg.sender] = License({
            version:      currentVer,
            expiry:       block.timestamp + duration,
            active:       true,
            sharesBacked: 0
        });

        // Distribute revenue to share pool
        properties[id].revenuePool    += msg.value;
        properties[id].licensesSold   += 1;

        // Refund excess ETH
        if (msg.value > price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - price}("");
            require(refundSuccess, "Refund failed");
        }

        emit LicensePurchased(id, msg.sender, price, currentVer);
    }

    /* ============================================================
       5. GRANT LICENSE (owner grants for free — e.g. to partners)
       ============================================================ */
    function grantLicense(uint256 id, address user, uint256 duration) public {
        require(ownerOf(id) == msg.sender, "Not owner");

        uint256 currentVer = properties[id].currentVersion;

        licenses[id][user] = License({
            version:      currentVer,
            expiry:       block.timestamp + duration,
            active:       true,
            sharesBacked: 0
        });

        emit LicenseGranted(id, user, currentVer);
    }

    /* ============================================================
       6. LICENSE VIA SHARE OWNERSHIP
       If you hold >= minSharesRequired shares, you get a free license.
       Share holders are co-owners so they deserve access.
       ============================================================ */
    function claimShareHolderLicense(uint256 id, uint256 duration) public {
        LicenseShareToken token = LicenseShareToken(properties[id].shareToken);
        uint256 held = token.balanceOf(msg.sender);
        require(held > 0, "No shares held");

        uint256 currentVer = properties[id].currentVersion;

        licenses[id][msg.sender] = License({
            version:      currentVer,
            expiry:       block.timestamp + duration,
            active:       true,
            sharesBacked: held
        });

        emit LicenseGranted(id, msg.sender, currentVer);
    }

    /* ============================================================
       7. REVOKE LICENSE
       ============================================================ */
    function revokeLicense(uint256 id, address user) public {
        require(ownerOf(id) == msg.sender, "Not owner");
        licenses[id][user].active = false;
        emit LicenseRevoked(id, user);
    }

    /* ============================================================
       8. VALIDATE LICENSE
       Key rule: license version must match the version it was issued on.
       If property updated to v2, v1 license is still valid FOR v1 content
       but isLicenseValidForVersion(id, user, 2) will return false.
       ============================================================ */
    function isLicenseValid(uint256 id, address user)
    public view returns (bool)
    {
        License memory lic = licenses[id][user];
        if (!lic.active)                    return false;
        if (block.timestamp > lic.expiry)   return false;
        return true;
    }

    function isLicenseValidForVersion(uint256 id, address user, uint256 version)
    public view returns (bool)
    {
        License memory lic = licenses[id][user];
        if (!lic.active)                    return false;
        if (block.timestamp > lic.expiry)   return false;
        if (lic.version != version)         return false; // VERSION LOCKED
        return true;
    }

    /* ============================================================
       9. REVENUE WITHDRAWAL FOR SHARE HOLDERS
       Share holders withdraw proportional to their share balance.
       ============================================================ */

    // Tracks how much each address already withdrew per property
    mapping(uint256 => mapping(address => uint256)) public withdrawn;
    // Total revenue ever added (monotonically increasing for correct accounting)
    mapping(uint256 => uint256) public totalRevenueEver;

    function buyLicense_v2(uint256 id, uint256 duration) internal {
        // Internal accounting helper — not called directly
        totalRevenueEver[id] += msg.value;
    }

    /*
     * Simplified revenue share:
     * claimable = (sharesHeld / TOTAL_SHARES) * totalRevenueEver - alreadyWithdrawn
     */
    function claimableRevenue(uint256 id, address holder) public view returns (uint256) {
        LicenseShareToken token = LicenseShareToken(properties[id].shareToken);
        uint256 held = token.balanceOf(holder);
        if (held == 0) return 0;

        uint256 totalPool   = properties[id].revenuePool;
        uint256 entitlement = (totalPool * held) / TOTAL_SHARES;
        uint256 alreadyPaid = withdrawn[id][holder];

        if (entitlement <= alreadyPaid) return 0;
        return entitlement - alreadyPaid;
    }

    function withdrawRevenue(uint256 id) public {
        uint256 amount = claimableRevenue(id, msg.sender);
        require(amount > 0, "Nothing to withdraw");

        withdrawn[id][msg.sender] += amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit RevenueWithdrawn(id, msg.sender, amount);
    }

    /* ============================================================
       10. TRANSFER SHARES (delegates to ERC20 share token)
       ============================================================ */
    function transferShares(uint256 id, address to, uint256 amount) public {
        LicenseShareToken token = LicenseShareToken(properties[id].shareToken);
        token.transferFrom(msg.sender, to, amount);  // caller must approve first
        emit SharesTransferred(id, msg.sender, to, amount);
    }

    /* ============================================================
       11. READ HELPERS
       ============================================================ */
    function getCurrentVersion(uint256 id) public view returns (uint256) {
        return properties[id].currentVersion;
    }

    function getShareToken(uint256 id) public view returns (address) {
        return properties[id].shareToken;
    }

    function getShareBalance(uint256 id, address holder) public view returns (uint256) {
        return LicenseShareToken(properties[id].shareToken).balanceOf(holder);
    }

    function getLicenseInfo(uint256 id, address user)
    public view
    returns (uint256 version, uint256 expiry, bool active, uint256 sharesBacked)
    {
        License memory lic = licenses[id][user];
        return (lic.version, lic.expiry, lic.active, lic.sharesBacked);
    }

    /* Anti-Copying & IP Verification Read Helpers */
    function isAssetRegistered(string memory cid) public view returns (bool) {
        return isCidRegistered[cid];
    }

    function getPropertyByCid(string memory cid) public view returns (uint256) {
        require(isCidRegistered[cid], "CID is not registered");
        return cidToPropertyId[cid];
    }

    function isContentRegistered(bytes32 contentHash) public view returns (bool) {
        return isContentHashRegistered[contentHash];
    }

    function getPropertyByContentHash(bytes32 contentHash) public view returns (uint256) {
        require(isContentHashRegistered[contentHash], "Content hash is not registered");
        return contentHashToPropertyId[contentHash];
    }

    function getPatentByCid(string memory cid) public view returns (
        uint256 id,
        address patentOwner,
        uint256 blockNumber,
        uint256 timestamp,
        bytes32 contentHash,
        string memory title
    ) {
        require(isCidRegistered[cid], "Asset is not patented on blockchain");
        uint256 propId = cidToPropertyId[cid];
        Property memory p = properties[propId];
        return (propId, ownerOf(propId), p.blockNumber, p.registrationTimestamp, p.contentHash, p.title);
    }

    function getPatentByHash(bytes32 contentHash) public view returns (
        uint256 id,
        address patentOwner,
        uint256 blockNumber,
        uint256 timestamp,
        string memory cid,
        string memory title
    ) {
        require(isContentHashRegistered[contentHash], "Asset hash is not patented on blockchain");
        uint256 propId = contentHashToPropertyId[contentHash];
        Property memory p = properties[propId];
        string memory propCid = versionCids[propId][p.currentVersion];
        return (propId, ownerOf(propId), p.blockNumber, p.registrationTimestamp, propCid, p.title);
    }
}
