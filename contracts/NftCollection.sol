// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/*
  NftCollection.sol

  ERC-721 compatible NFT collection with:
   - admin-only minting (owner)
   - maxSupply enforcement
   - baseURI tokenURI scheme
   - pausable minting/transfers via Pausable
   - approvals and operator approvals (ERC721)
   - optional burn
   - clear revert messages
*/

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NftCollection is ERC721, ERC721Burnable, Pausable, Ownable {
    uint256 public immutable maxSupply;
    uint256 private _totalSupply;
    string private _baseTokenURI;

    // Track existence - optional but makes explicit checks
    mapping(uint256 => bool) private _existsMap;

    event BaseURIUpdated(string newBaseURI);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        string memory baseURI_
    ) ERC721(name_, symbol_) {
        require(maxSupply_ > 0, "Max supply must be > 0");
        maxSupply = maxSupply_;
        _baseTokenURI = baseURI_;
    }

    // ----- Views -----
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function exists(uint256 tokenId) public view returns (bool) {
        return _existsMap[tokenId];
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // Returns metadata URI for tokenId; reverts if token doesn't exist
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_existsMap[tokenId], "ERC721Metadata: URI query for nonexistent token");
        return super.tokenURI(tokenId);
    }

    // ----- Admin / Config -----
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ----- Minting -----
    // Owner-only safe mint. Checks maxSupply and non-zero recipient, non-duplicate tokenId.
    function safeMint(address to, uint256 tokenId) external onlyOwner whenNotPaused {
        _mintInternal(to, tokenId);
    }

    // Internal mint helper that centralizes checks & emits Transfer as ERC721 does
    function _mintInternal(address to, uint256 tokenId) internal {
        require(to != address(0), "Mint to zero address");
        require(!_existsMap[tokenId], "Token already minted");
        require(_totalSupply + 1 <= maxSupply, "Max supply reached");
        // optional tokenId range check: ensure tokenId is positive and <= maxSupply*10 (example)
        // If you want strict 1..maxSupply range, uncomment:
        // require(tokenId >= 1 && tokenId <= maxSupply, "tokenId out of valid range");

        // Update state atomically
        _existsMap[tokenId] = true;
        _totalSupply += 1;
        _safeMint(to, tokenId);
    }

    // Optional admin batch mint
    function batchMint(address[] calldata recipients, uint256[] calldata tokenIds) external onlyOwner whenNotPaused {
        require(recipients.length == tokenIds.length, "Array length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            _mintInternal(recipients[i], tokenIds[i]);
        }
    }

    // ----- Hooks / overrides to respect paused state -----
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override
        whenNotPaused
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // ----- Burning override to keep totalSupply consistent -----
    function burn(uint256 tokenId) public override {
        address ownerOfToken = ownerOf(tokenId);
        super.burn(tokenId); // this will clear approvals and reduce balances
        // update our custom supply and exists map
        if (_existsMap[tokenId]) {
            _existsMap[tokenId] = false;
            _totalSupply -= 1;
        }
        // Post-condition: totalSupply never negative because minted increments earlier
        require(_totalSupply >= 0, "totalSupply underflow");
    }

    // ----- Misc -----
    // Make baseURI externally readable
    function baseTokenURI() external view returns (string memory) {
        return _baseTokenURI;
    }
}
