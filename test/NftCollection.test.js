const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NftCollection", function () {
  let Nft, nft, owner, addr1, addr2, addr3;
  const NAME = "MyCollection";
  const SYMBOL = "MYC";
  const MAX_SUPPLY = 5;
  const BASE_URI = "https://example.com/metadata/";

  beforeEach(async () => {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    Nft = await ethers.getContractFactory("NftCollection");
    nft = await Nft.deploy(NAME, SYMBOL, MAX_SUPPLY, BASE_URI);
    await nft.deployed();
  });

  it("initial config: name, symbol, maxSupply and totalSupply", async () => {
    expect(await nft.name()).to.equal(NAME);
    expect(await nft.symbol()).to.equal(SYMBOL);
    expect(await nft.maxSupply()).to.equal(MAX_SUPPLY);
    expect(await nft.totalSupply()).to.equal(0);
  });

  it("owner can mint and totalSupply and balances update", async () => {
    await expect(nft.connect(owner).safeMint(addr1.address, 1))
      .to.emit(nft, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1);

    expect(await nft.totalSupply()).to.equal(1);
    expect(await nft.balanceOf(addr1.address)).to.equal(1);
    expect(await nft.ownerOf(1)).to.equal(addr1.address);
    expect(await nft.tokenURI(1)).to.equal(BASE_URI + "1");
  });

  it("non-owner cannot mint", async () => {
    await expect(nft.connect(addr1).safeMint(addr1.address, 2)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("cannot mint duplicate tokenId", async () => {
    await nft.connect(owner).safeMint(addr1.address, 10);
    await expect(nft.connect(owner).safeMint(addr2.address, 10)).to.be.revertedWith("Token already minted");
  });

  it("cannot mint beyond maxSupply", async () => {
    // mint up to maxSupply
    for (let i = 1; i <= MAX_SUPPLY; i++) {
      await nft.connect(owner).safeMint(owner.address, i);
    }
    expect(await nft.totalSupply()).to.equal(MAX_SUPPLY);
    // next mint should revert
    await expect(nft.connect(owner).safeMint(addr1.address, 999)).to.be.revertedWith("Max supply reached");
  });

  it("transfers: owner -> approved -> transfer succeeds and events emitted", async () => {
    await nft.connect(owner).safeMint(addr1.address, 21);
    // approve addr2
    await expect(nft.connect(addr1).approve(addr2.address, 21))
      .to.emit(nft, "Approval")
      .withArgs(addr1.address, addr2.address, 21);

    await expect(nft.connect(addr2).transferFrom(addr1.address, addr3.address, 21))
      .to.emit(nft, "Transfer")
      .withArgs(addr1.address, addr3.address, 21);

    expect(await nft.ownerOf(21)).to.equal(addr3.address);
  });

  it("operator approvals allow transfer of multiple tokens", async () => {
    await nft.connect(owner).safeMint(addr1.address, 101);
    await nft.connect(owner).safeMint(addr1.address, 102);

    await expect(nft.connect(addr1).setApprovalForAll(addr2.address, true))
      .to.emit(nft, "ApprovalForAll")
      .withArgs(addr1.address, addr2.address, true);

    expect(await nft.isApprovedForAll(addr1.address, addr2.address)).to.equal(true);

    // operator transfers token 101
    await nft.connect(addr2).transferFrom(addr1.address, addr3.address, 101);
    expect(await nft.ownerOf(101)).to.equal(addr3.address);
  });

  it("transferring non-existent token reverts", async () => {
    await expect(nft.transferFrom(addr1.address, addr2.address, 9999)).to.be.reverted;
  });

  it("pausing prevents mint and transfers", async () => {
    await nft.connect(owner).pause();
    await expect(nft.connect(owner).safeMint(addr1.address, 7)).to.be.revertedWith("Pausable: paused");

    // unpause then mint
    await nft.connect(owner).unpause();
    await nft.connect(owner).safeMint(addr1.address, 7);
    // pause and try transfer
    await nft.connect(owner).pause();
    await expect(nft.connect(addr1).transferFrom(addr1.address, addr2.address, 7)).to.be.revertedWith("Pausable: paused");
  });

  it("burn updates totalSupply and balances", async () => {
    await nft.connect(owner).safeMint(addr1.address, 55);
    expect(await nft.totalSupply()).to.equal(1);
    await nft.connect(addr1).burn(55);
    expect(await nft.totalSupply()).to.equal(0);
    await expect(nft.ownerOf(55)).to.be.reverted; // non-existent
  });

  it("approval revocation and repeated approvals behave correctly", async () => {
    await nft.connect(owner).safeMint(addr1.address, 200);
    await nft.connect(addr1).approve(addr2.address, 200);
    expect(await nft.getApproved(200)).to.equal(addr2.address);
    // revoke by approving zero
    await nft.connect(addr1).approve(ethers.constants.AddressZero, 200);
    expect(await nft.getApproved(200)).to.equal(ethers.constants.AddressZero);
  });

  it("gas usage: mint + transfer under reasonable bound", async function () {
    // gas measurement - this is approximate and asserts it's not extremely high
    const mintTx = await nft.connect(owner).safeMint(addr1.address, 300);
    const mintRec = await mintTx.wait();
    const transferTx = await nft.connect(addr1).transferFrom(addr1.address, addr2.address, 300);
    const transferRec = await transferTx.wait();

    const mintGas = mintRec.gasUsed.toNumber();
    const transferGas = transferRec.gasUsed.toNumber();

    // these thresholds are intentionally generous for local EVM
    expect(mintGas).to.be.lessThan(400000);
    expect(transferGas).to.be.lessThan(200000);
  });
});
