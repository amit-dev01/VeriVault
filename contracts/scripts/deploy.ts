import hre from "hardhat";

const { ethers, network } = hre;

async function main() {
  console.log("=================================================");
  console.log(" VeriVault: Smart Contract Deployment");
  console.log(` Network: ${network.name} (Chain ID: ${network.config.chainId})`);
  console.log("=================================================\n");

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer signer found. Please check your private key configuration in .env");
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer Account: ${deployer.address}`);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} POL/MATIC\n`);

  // Constructor arguments: initialAdmin address
  const initialAdmin = process.env.INITIAL_ADMIN || deployer.address;
  const constructorArgs = [initialAdmin];

  console.log("Constructor Arguments:");
  console.log(JSON.stringify({ defaultAdmin: initialAdmin }, null, 2));
  console.log("\nDeploying VeriVaultCredentials...");

  const VeriVaultCredentialsFactory = await ethers.getContractFactory("VeriVaultCredentials");
  const contract = await VeriVaultCredentialsFactory.deploy(initialAdmin);

  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();

  console.log("\n-------------------------------------------------");
  console.log(" Deployment Successful!");
  console.log("-------------------------------------------------");
  console.log(`Contract Name:        VeriVaultCredentials`);
  console.log(`Deployed Address:     ${deployedAddress}`);
  console.log(`Transaction Hash:     ${deploymentTx?.hash}`);
  console.log(`Constructor Arguments: ${JSON.stringify(constructorArgs)}`);
  console.log("-------------------------------------------------\n");

  console.log("Polygon Amoy Verification Command:");
  console.log(
    `npx hardhat verify --network polygonAmoy ${deployedAddress} ${initialAdmin}\n`
  );

  return {
    contractAddress: deployedAddress,
    constructorArgs,
  };
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
