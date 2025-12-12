NFT Collection – Dockerized Hardhat Project
This project implements an ERC-721 NFT smart contract with minting, transfers, approvals, metadata,
burning, pausing, and access control. A full automated test suite is provided and can be executed both
locally and inside a Docker container.
Project Structure
project-root/
contracts/
NftCollection.sol
test/
NftCollection.test.js
package.json
hardhat.config.js
Dockerfile
.dockerignore
README.md
Tools & Versions Used
- Node.js: 20.x
- Hardhat: 2.27.x
- Solidity: 0.8.17
- Ethers.js: 5.x
- Docker Desktop
Running the Project in Docker
1. Build the Docker Image:
docker build -t nft-contract .
2. Run Tests:
docker run --rm nft-contract
Expected output: 12 passing
Dockerfile Overview
FROM node:20-bullseye
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY . .
RUN npx hardhat compile
CMD ["npx", "hardhat", "test"]
Assumptions
- Tests run in Docker only
- No external RPC needed
- Node 20 required for plugin compatibility
Test Coverage Summary
- Initialization
- Minting rules
- Max supply
- Transfers & approvals
- Pausing & burning
- Gas efficiency