import { expect } from "chai";
import { BigNumber } from "ethers";
import hre, { ethers, network, waffle, deployments } from "hardhat";
import { _TypedDataEncoder } from "@ethersproject/hash";
import {
  executeContractCallWithSigners,
  buildContractCall,
} from "./shared/utils";
import { AddressZero } from "@ethersproject/constants";
import { signTypedMessage, TypedDataUtils } from "eth-sig-util";
import { ecsign } from "ethereumjs-util";
import Wallet from "ethereumjs-wallet";

const deadline =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("quadraticOZVotingStrategy:", () => {
  const [wallet_0, wallet_1, wallet_2, wallet_3] = waffle.provider.getWallets();
  const chainId = ethers.BigNumber.from(network.config.chainId).toNumber();
  const tx = {
    to: wallet_1.address,
    value: 0,
    data: "0x",
    operation: 0,
    nonce: 0,
  };
  const baseSetup = deployments.createFixture(async () => {
    await deployments.fixture();
    const [wallet_0, wallet_1, wallet_2, wallet_3] =
      waffle.provider.getWallets();
    const defaultBalance = ethers.BigNumber.from("1000000000000000000");
    const thresholdBalance = ethers.BigNumber.from("2000000000000000000");
    const totalSupply = ethers.BigNumber.from("100000000000000000000000");
    const safeSupply = ethers.BigNumber.from("50000000000000000000000");
    const govTokenContract = await ethers.getContractFactory("GovernanceToken");
    const govToken = await govTokenContract.deploy(
      "GovToken",
      "GT",
      totalSupply
    );
    await govToken.transfer(wallet_1.address, defaultBalance);
    await govToken.transfer(wallet_2.address, defaultBalance);
    await govToken.transfer(wallet_3.address, defaultBalance);

    const GnosisSafeL2 = await hre.ethers.getContractFactory(
      "@gnosis.pm/safe-contracts/contracts/GnosisSafeL2.sol:GnosisSafeL2"
    );
    const FactoryContract = await hre.ethers.getContractFactory(
      "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol:GnosisSafeProxyFactory"
    );
    const singleton = await GnosisSafeL2.deploy();
    const factory = await FactoryContract.deploy();
    const template = await factory.callStatic.createProxy(
      singleton.address,
      "0x"
    );
    await factory
      .createProxy(singleton.address, "0x")
      .then((tx: any) => tx.wait());
    const safe = GnosisSafeL2.attach(template);
    safe.setup(
      [wallet_0.address],
      1,
      AddressZero,
      "0x",
      AddressZero,
      AddressZero,
      0,
      AddressZero
    );

    const moduleFactoryContract = await ethers.getContractFactory(
      "ModuleProxyFactory"
    );
    const moduleFactory = await moduleFactoryContract.deploy();

    const quadraticContract = await ethers.getContractFactory("MemberQuadraticVoting");
    const quadraticVotingMaster = await quadraticContract.deploy(
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000001",
      2, // number of votes wieghted to pass
      1,
      1, // number of days proposals are active
      ""
    );
    const encodedQuadraticInitParams = ethers.utils.defaultAbiCoder.encode(
      [
        "address",
        "address",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "string",
      ],
      [
        wallet_0.address,
        govToken.address,
        "0x0000000000000000000000000000000000000001",
        60,
        thresholdBalance, // number of votes wieghted to pass
        60, // number of days proposals are active
        "Test",
      ]
    );
    const initQuadraticData = quadraticVotingMaster.interface.encodeFunctionData(
      "setUp",
      [encodedQuadraticInitParams]
    );
    const masterQuadtraticCopyAddress = quadraticVotingMaster.address
      .toLowerCase()
      .replace(/^0x/, "");
    const byteCodeQuadtratic =
      "0x602d8060093d393df3363d3d373d3d3d363d73" +
      masterQuadtraticCopyAddress +
      "5af43d82803e903d91602b57fd5bf3";
    const saltQuadtratic = ethers.utils.solidityKeccak256(
      ["bytes32", "uint256"],
      [ethers.utils.solidityKeccak256(["bytes"], [initQuadraticData]), "0x01"]
    );
    const expectedQuadtraticAddress = ethers.utils.getCreate2Address(
      moduleFactory.address,
      saltQuadtratic,
      ethers.utils.keccak256(byteCodeQuadtratic)
    );
    expect(
      await moduleFactory.deployModule(
        quadraticVotingMaster.address,
        initQuadraticData,
        "0x01"
      )
    )
      .to.emit(moduleFactory, "ModuleProxyCreation")
      .withArgs(expectedQuadtraticAddress, quadraticVotingMaster.address);
    const quadtraticVoting = quadraticVotingMaster.attach(expectedQuadtraticAddress);

    const proposalContract = await ethers.getContractFactory("Seele");
    const masterProposalModule = await proposalContract.deploy(
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000001",
      []
    );
    const encodedInitParams = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "address", "address[]"],
      [safe.address, safe.address, safe.address, [quadtraticVoting.address]]
    );
    const initData = masterProposalModule.interface.encodeFunctionData(
      "setUp",
      [encodedInitParams]
    );
    const masterCopyAddress = masterProposalModule.address
      .toLowerCase()
      .replace(/^0x/, "");
    const byteCode =
      "0x602d8060093d393df3363d3d373d3d3d363d73" +
      masterCopyAddress +
      "5af43d82803e903d91602b57fd5bf3";
    const salt = ethers.utils.solidityKeccak256(
      ["bytes32", "uint256"],
      [ethers.utils.solidityKeccak256(["bytes"], [initData]), "0x01"]
    );
    const expectedAddress = ethers.utils.getCreate2Address(
      moduleFactory.address,
      salt,
      ethers.utils.keccak256(byteCode)
    );
    expect(
      await moduleFactory.deployModule(
        masterProposalModule.address,
        initData,
        "0x01"
      )
    )
      .to.emit(moduleFactory, "ModuleProxyCreation")
      .withArgs(expectedAddress, masterProposalModule.address);
    const proposalModule = proposalContract.attach(expectedAddress);

    await quadtraticVoting.setSeele(expectedAddress);
    await quadtraticVoting.transferOwnership(safe.address);

    await govToken.transfer(safe.address, safeSupply);
    const addCall = buildContractCall(
      safe,
      "addOwnerWithThreshold",
      [wallet_1.address, 1],
      await safe.nonce()
    );
    const addCall_1 = buildContractCall(
      safe,
      "addOwnerWithThreshold",
      [wallet_2.address, 1],
      await safe.nonce()
    );
    const txHash = await proposalModule.getTransactionHash(
      addCall.to,
      addCall.value,
      addCall.data,
      addCall.operation,
      0
    );
    const txHash_1 = await proposalModule.getTransactionHash(
      addCall_1.to,
      addCall_1.value,
      addCall_1.data,
      addCall_1.operation,
      0
    );
    await executeContractCallWithSigners(
      safe,
      safe,
      "enableModule",
      [proposalModule.address],
      [wallet_0]
    );

    return {
      proposalModule,
	  quadtraticVoting,
      govToken,
      factory,
      txHash,
      txHash_1,
      addCall,
      addCall_1,
      safe,
      defaultBalance,
      thresholdBalance,
    };
  });

  describe("setUp", async () => {
    it("can register quadtratic voting module", async () => {
      const { proposalModule, quadtraticVoting } = await baseSetup();
      expect(
        await proposalModule.isStrategyEnabled(quadtraticVoting.address)
      ).to.equal(true);
    });

    it("only owner can register linear voting module", async () => {
      const { proposalModule, quadtraticVoting } = await baseSetup();
      await expect(
        proposalModule.enableStrategy(quadtraticVoting.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("state is initialized correctly", async () => {
      const { quadtraticVoting, safe, govToken } = await baseSetup();
      expect(await quadtraticVoting.governanceToken()).to.equal(govToken.address);
      expect(await quadtraticVoting.votingPeriod()).to.equal(60);
      expect(await quadtraticVoting.quorumThreshold()).to.equal(
        "2000000000000000000"
      );
      expect(await quadtraticVoting.timeLockPeriod()).to.equal(60);
    });
  });

  // describe("Membership OZ quadraticVoting", async () => {
  //   it("cannot finalize if not past threshold", async () => {
  //     const {
  //       proposalModule,
  //       linearVoting,
  //       govToken,
  //       addCall,
  //       txHash,
  //       defaultBalance,
  //     } = await baseSetup();
  //     await govToken.connect(wallet_2).delegate(wallet_0.address);
  //     await proposalModule.submitProposal([txHash], linearVoting.address, "0x");
  //     await linearVoting.vote(0, 1);
  //     let proposal = await linearVoting.proposals(0);
  //     expect(proposal.yesVotes).to.equal(defaultBalance);
  //     await network.provider.send("evm_increaseTime", [60]);
  //     await expect(linearVoting.finalizeStrategy(0)).to.be.revertedWith(
  //       "a quorum has not been reached for the proposal"
  //     );
  //   });

  //   it("can complete a funding proposals", async () => {
  //     const { proposalModule, govToken, linearVoting, safe } =
  //       await baseSetup();
  //     await govToken.delegate(wallet_0.address);
  //     let transferCall = buildContractCall(
  //       govToken,
  //       "transfer",
  //       [wallet_2.address, 1000],
  //       await safe.nonce()
  //     );
  //     const txHash = await proposalModule.getTransactionHash(
  //       transferCall.to,
  //       transferCall.value,
  //       transferCall.data,
  //       transferCall.operation,
  //       0
  //     );
  //     await proposalModule.submitProposal([txHash], linearVoting.address, "0x");
  //     await linearVoting.vote(0, 1);
  //     let proposal = await proposalModule.proposals(0);
  //     await network.provider.send("evm_increaseTime", [60]);
  //     await linearVoting.finalizeStrategy(0);
  //     await network.provider.send("evm_increaseTime", [60]);
  //     await proposalModule.executeProposalByIndex(
  //       0, // proposalId
  //       govToken.address, // target
  //       0, // value
  //       transferCall.data, // data
  //       0, // call operation
  //       0 // txHash index
  //     );
  //     expect(await govToken.balanceOf(wallet_2.address)).to.equal(
  //       ethers.BigNumber.from("1000000000000001000")
  //     );
  //   });

  //   it("vote weight scales quadratically", async () => {

  //   })
  // });
});