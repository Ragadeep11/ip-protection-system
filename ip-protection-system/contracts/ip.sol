// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
IP Lifecycle System

Features:
1. NFT-based ownership (ERC721)
2. Linear versioning (append-only)
3. Version-bound licensing
4. Expiry-based license
5. Safe and minimal storage
*/

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract IPRegistry is ERC721 {

    uint256 public propertyCounter;

    struct Property {
        uint256 currentVersion;
    }

    struct License {
        uint256 version;   // version licensed
        uint256 expiry;    // timestamp expiry
        bool active;
    }

    // propertyId => Property
    mapping(uint256 => Property) public properties;

    // propertyId => version => IPFS CID
    mapping(uint256 => mapping(uint256 => string)) public versionCids;

    // propertyId => user => License
    mapping(uint256 => mapping(address => License)) public licenses;

    event PropertyRegistered(uint256 indexed id, address indexed owner);
    event PropertyUpdated(uint256 indexed id, uint256 newVersion);
    event LicenseGranted(uint256 indexed id, address indexed user);

    constructor() ERC721("IPToken", "IPT") {}

    function registerProperty(string memory cid) public {

        uint256 id = propertyCounter;

        _mint(msg.sender, id);

        properties[id].currentVersion = 1;
        versionCids[id][1] = cid;

        emit PropertyRegistered(id, msg.sender);

        propertyCounter++;
    }

    function updateProperty(uint256 id, string memory newCid) public {

        require(ownerOf(id) == msg.sender, "Not owner");

        properties[id].currentVersion += 1;

        uint256 newVersion = properties[id].currentVersion;
        versionCids[id][newVersion] = newCid;

        emit PropertyUpdated(id, newVersion);
    }

    function grantLicense(
        uint256 id,
        address user,
        uint256 duration
    ) public {

        require(ownerOf(id) == msg.sender, "Not owner");

        uint256 currentVer = properties[id].currentVersion;

        licenses[id][user] = License({
            version: currentVer,
            expiry: block.timestamp + duration,
            active: true
        });

        emit LicenseGranted(id, user);
    }

    function revokeLicense(uint256 id, address user) public {
        require(ownerOf(id) == msg.sender, "Not owner");
        licenses[id][user].active = false;
    }

    function isLicenseValid(uint256 id, address user)
    public
    view
    returns (bool)
    {
        License memory lic = licenses[id][user];

        if (!lic.active) return false;
        if (block.timestamp > lic.expiry) return false;

        return true;
    }

    function getCurrentVersion(uint256 id) public view returns (uint256) {
        return properties[id].currentVersion;
    }
}