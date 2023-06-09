import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers, upgrades } from "hardhat";

describe("TokenVeZOIC", () => {
  let tokenZOIC: Contract;
  let tokenVeZOIC: Contract;
  let tokenCoffer: Contract;
  beforeEach(async () => {
    const TokenCoffer = await ethers.getContractFactory("TokenCoffer");
    tokenCoffer = await upgrades.deployProxy(TokenCoffer, []);
    await tokenCoffer.deployed();

    const [owner] = await ethers.getSigners();
    await tokenCoffer.grantRole(ethers.utils.id("WITHDRAW"), owner.address);

    const TokenZOIC = await ethers.getContractFactory("TokenZOIC");
    tokenZOIC = await upgrades.deployProxy(TokenZOIC, [
      [tokenCoffer.address],
      [10000],
    ]);
    await tokenZOIC.deployed();

    const TokenVeZOIC = await ethers.getContractFactory("TokenVeZOIC");
    tokenVeZOIC = await upgrades.deployProxy(TokenVeZOIC, [tokenZOIC.address]);
    await tokenVeZOIC.deployed();
  });
  it("should be deploy", async () => {
    expect(await tokenZOIC.name()).to.equal("TokenZOIC");
    expect(await tokenZOIC.symbol()).to.equal("ZOIC");
    expect(await tokenZOIC.decimals()).to.equal(18);

    expect(await tokenVeZOIC.name()).to.equal("veTokenZOIC");
    expect(await tokenVeZOIC.symbol()).to.equal("veZOIC");
    expect(await tokenVeZOIC.decimals()).to.equal(18);
  });

  describe("balanceOf", () => {
    it("should return 0", async () => {
      expect(await tokenVeZOIC.name()).to.equal("veTokenZOIC");
      expect(await tokenVeZOIC.symbol()).to.equal("veZOIC");
      expect(await tokenVeZOIC.decimals()).to.equal(18);
      const [owner] = await ethers.getSigners();
      expect(await tokenVeZOIC.balanceOf(owner.address)).to.equal(0);
    });
  });

  describe("createLock", () => {
    let amount: BigNumber = ethers.utils.parseEther("100");
    beforeEach(async () => {
      const [owner] = await ethers.getSigners();
      //mint 100 token
      await tokenCoffer
        .connect(owner)
        .withdrawERC20(tokenZOIC.address, owner.address, amount);
    });
    it("should create lock", async () => {
      const [owner] = await ethers.getSigners();

      const week = 7 * 24 * 60 * 60;
      const lockTime = Math.floor(new Date().getTime() / 1000) + week;
      await tokenZOIC.approve(tokenVeZOIC.address, amount);

      //get block timestamp
      const block = await ethers.provider.getBlock("latest");

      await expect(tokenVeZOIC.createLock(amount, BigNumber.from(lockTime)))
        .to.emit(tokenVeZOIC, "Deposit")
        .withArgs(
          owner.address,
          amount,
          BigNumber.from(Math.floor(lockTime / week) * week),
          0,
          (x: BigNumber) => x.gt(block.timestamp)
        )
        .to.emit(tokenVeZOIC, "Supply")
        .withArgs(0, amount);

      const lockBalance = await tokenVeZOIC.lockedBalanceOf(owner.address);
      expect(lockBalance.amount).to.equal(amount);
      expect(lockBalance.end).to.equal(
        BigNumber.from(Math.floor(lockTime / week) * week)
      );

      expect(await tokenZOIC.balanceOf(tokenVeZOIC.address)).to.equal(amount);

      await tokenVeZOIC.lockedTotalSupply().then((x: BigNumber) => {
        expect(x).to.equal(amount);
      });

      expect(await tokenZOIC.balanceOf(owner.address)).to.equal(0);
    });

    it("should create lock failed: already lock", async () => {
      const [owner] = await ethers.getSigners();

      const week = 7 * 24 * 60 * 60;
      const lockTime = Math.floor(new Date().getTime() / 1000) + week;
      await tokenZOIC.approve(tokenVeZOIC.address, amount);

      await tokenVeZOIC.createLock(amount.div(2), BigNumber.from(lockTime));

      await expect(
        tokenVeZOIC.createLock(amount.div(2), BigNumber.from(lockTime))
      ).to.be.revertedWithCustomError(
        tokenVeZOIC,
        "Error_VeTokenUpgradeable__Require_Already_Have_A_Lock"
      );
    });

    it("should create lock success, get veToken", async () => {
      const [owner] = await ethers.getSigners();

      const week = 7 * 24 * 60 * 60;
      const lockTime = Math.floor(new Date().getTime() / 1000) + week;
      await tokenZOIC.approve(tokenVeZOIC.address, amount);

      //get block timestamp
      const block = await ethers.provider.getBlock("latest");

      let balanceAtTime1 = 0;
      await expect(tokenVeZOIC.createLock(amount, BigNumber.from(lockTime)))
        .to.emit(tokenVeZOIC, "Deposit")
        .withArgs(
          owner.address,
          amount,
          BigNumber.from(Math.floor(lockTime / week) * week),
          0,
          (x: BigNumber) => {
            balanceAtTime1 = x.toNumber();
            return x.gt(block.timestamp);
          }
        )
        .to.emit(tokenVeZOIC, "Supply")
        .withArgs(0, amount);

      const veTokenBalance: BigNumber = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        balanceAtTime1
      );
      console.log("veTokenBalance", veTokenBalance.toString());
      expect(veTokenBalance).not.eq(0);

      const blockAfterLock = await ethers.provider.getBlock("latest");
      const balanceAtTime2 = blockAfterLock.timestamp + week + 1;
      const veTokenBalance2: BigNumber = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        balanceAtTime2
      );
      console.log("veTokenBalance2", veTokenBalance2.toString());
      expect(veTokenBalance2).to.eq(0);
    });
  });

  describe("calculateUnlockTime", () => {
    const valuesToTest = [
      ["0", "0"],
      ["1", "0"],
      ["604800", "604800"],
      ["604801", "604800"],
      ["1209600", "1209600"],
      ["1220000", "1209600"],
    ];
    valuesToTest.forEach(([unlockTime, expected]) => {
      it(`should in ${unlockTime} return ${expected}`, async () => {
        expect(await tokenVeZOIC.calculateUnlockTime(unlockTime)).to.equal(
          expected
        );
      });
    });
  });

  describe("balanceOfAtTime", () => {
    let amount: BigNumber = ethers.utils.parseEther("100");
    let snapshotId: string;

    beforeEach(async () => {
      snapshotId = await ethers.provider.send("evm_snapshot", []);
      const [owner] = await ethers.getSigners();
      //mint token
      await tokenCoffer
        .connect(owner)
        .withdrawERC20(tokenZOIC.address, owner.address, amount);
    });
    afterEach(async () => {
      await ethers.provider.send("evm_revert", [snapshotId]);
    });
    it("should create lock: 1 Week", async () => {
      const [owner] = await ethers.getSigners();

      const week = 7 * 24 * 60 * 60;
      const lockTime = Math.floor(new Date().getTime() / 1000) + week;
      await tokenZOIC.approve(tokenVeZOIC.address, amount);

      //get block timestamp
      const block = await ethers.provider.getBlock("latest");

      let balanceAtTime1 = 0;
      await expect(tokenVeZOIC.createLock(amount, BigNumber.from(lockTime)))
        .to.emit(tokenVeZOIC, "Deposit")
        .withArgs(
          owner.address,
          amount,
          BigNumber.from(Math.floor(lockTime / week) * week),
          0,
          (x: BigNumber) => {
            balanceAtTime1 = x.toNumber();
            return x.gt(block.timestamp);
          }
        )
        .to.emit(tokenVeZOIC, "Supply")
        .withArgs(0, amount);

      const veTokenBalance: BigNumber = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        balanceAtTime1
      );
      expect(veTokenBalance).not.eq(0);

      const blockAfterLock = await ethers.provider.getBlock("latest");
      const balanceAtTime2 = blockAfterLock.timestamp + week + 1;
      const veTokenBalance2: BigNumber = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        balanceAtTime2
      );
      expect(veTokenBalance2).to.eq(0);
    });

    it("should create lock: 2 Week", async () => {
      const [owner] = await ethers.getSigners();

      const week = 7 * 24 * 60 * 60;
      const lockTime = Math.floor(new Date().getTime() / 1000) + week + week;
      await tokenZOIC.approve(tokenVeZOIC.address, amount);

      //get block timestamp
      const block = await ethers.provider.getBlock("latest");

      let balanceAtTime1 = 0;
      await expect(tokenVeZOIC.createLock(amount, BigNumber.from(lockTime)))
        .to.emit(tokenVeZOIC, "Deposit")
        .withArgs(
          owner.address,
          amount,
          BigNumber.from(Math.floor(lockTime / week) * week),
          0,
          (x: BigNumber) => {
            balanceAtTime1 = x.toNumber();
            return x.gt(block.timestamp);
          }
        )
        .to.emit(tokenVeZOIC, "Supply")
        .withArgs(0, amount);

      const veTokenBalance: BigNumber = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        balanceAtTime1
      );
      expect(veTokenBalance).not.eq(0);

      const blockAfterLock = await ethers.provider.getBlock("latest");
      const balanceAtTime2 = blockAfterLock.timestamp + week + 1;
      const veTokenBalance2: BigNumber = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        balanceAtTime2
      );
      expect(veTokenBalance2).not.eq(0);

      const balanceAtTime3 = blockAfterLock.timestamp + week + week + 1;
      const veTokenBalance3: BigNumber = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        balanceAtTime3
      );
      expect(veTokenBalance3).eq(0);
    });
  });

  describe("withdraw", () => {
    let amount: number = 100;
    let snapshotId: string;
    beforeEach(async () => {
      snapshotId = await ethers.provider.send("evm_snapshot", []);
      const [owner] = await ethers.getSigners();
      //mint 100 token
      await tokenCoffer
        .connect(owner)
        .withdrawERC20(tokenZOIC.address, owner.address, amount);
    });
    afterEach(async () => {
      await ethers.provider.send("evm_revert", [snapshotId]);
    });
    it("should success", async () => {
      const [owner] = await ethers.getSigners();

      const week = 7 * 24 * 60 * 60;
      const lockTime = Math.floor(new Date().getTime() / 1000) + week;
      await tokenZOIC.approve(tokenVeZOIC.address, amount);

      await tokenVeZOIC.createLock(amount, BigNumber.from(lockTime));

      //check lock balance
      const lockBalance = await tokenVeZOIC.lockedBalanceOf(owner.address);
      expect(lockBalance.amount).to.equal(amount);
      expect(lockBalance.end).to.equal(
        BigNumber.from(Math.floor(lockTime / week) * week)
      );

      //check token balance
      expect(await tokenZOIC.balanceOf(tokenVeZOIC.address)).to.equal(amount);
      expect(await tokenZOIC.balanceOf(owner.address)).to.equal(0);

      //change block timestamp + 1 week
      await ethers.provider.send("evm_increaseTime", [week]);

      await tokenVeZOIC.checkpoint();

      //get block timestamp
      let block = await ethers.provider.getBlock("latest");

      //withdraw
      await expect(tokenVeZOIC.withdraw())
        .to.emit(tokenVeZOIC, "Withdraw")
        .withArgs(owner.address, amount, (x: BigNumber) =>
          x.gt(block.timestamp)
        )
        .to.emit(tokenVeZOIC, "Supply")
        .withArgs(amount, 0);

      //check lock balance
      const lockBalance2 = await tokenVeZOIC.lockedBalanceOf(owner.address);
      expect(lockBalance2.amount).to.equal(0);
      expect(lockBalance2.end).to.equal(0);

      //check token balance
      expect(await tokenZOIC.balanceOf(tokenVeZOIC.address)).to.equal(0);
      expect(await tokenZOIC.balanceOf(owner.address)).to.equal(amount);
    });

    it("should failed: not lock", async () => {
      //withdraw
      await expect(tokenVeZOIC.withdraw()).rejectedWith(
        "VeToken: no locked balance to withdraw"
      );
    });

    it("should failed: not unlock", async () => {
      const [owner] = await ethers.getSigners();

      const week = 7 * 24 * 60 * 60;
      const lockTime = Math.floor(new Date().getTime() / 1000) + week;
      await tokenZOIC.approve(tokenVeZOIC.address, amount);

      await tokenVeZOIC.createLock(amount, BigNumber.from(lockTime));

      //check lock balance
      const lockBalance = await tokenVeZOIC.lockedBalanceOf(owner.address);
      expect(lockBalance.amount).to.equal(amount);
      expect(lockBalance.end).to.equal(
        BigNumber.from(Math.floor(lockTime / week) * week)
      );

      //check token balance
      expect(await tokenZOIC.balanceOf(tokenVeZOIC.address)).to.equal(amount);
      expect(await tokenZOIC.balanceOf(owner.address)).to.equal(0);

      //withdraw
      await expect(tokenVeZOIC.withdraw()).rejectedWith(
        "VeToken: locked balance is not unlock"
      );
    });
  });

  describe("increaseAmount", () => {
    let amount: BigNumber = ethers.utils.parseEther("100");
    let amount2: BigNumber = ethers.utils.parseEther("100");
    let snapshotId: string;
    beforeEach(async () => {
      snapshotId = await ethers.provider.send("evm_snapshot", []);
      const [owner] = await ethers.getSigners();
      //mint 100 token
      await tokenCoffer
        .connect(owner)
        .withdrawERC20(tokenZOIC.address, owner.address, amount);
      //mint 100 token
      await tokenCoffer
        .connect(owner)
        .withdrawERC20(tokenZOIC.address, owner.address, amount2);
    });
    afterEach(async () => {
      await ethers.provider.send("evm_revert", [snapshotId]);
    });

    it("should success", async () => {
      const [owner] = await ethers.getSigners();

      const week = 7 * 24 * 60 * 60;
      const lockTime = Math.floor(new Date().getTime() / 1000) + week;
      await tokenZOIC.approve(tokenVeZOIC.address, amount.add(amount2));

      //get block timestamp
      const block = await ethers.provider.getBlock("latest");

      let createLockTime = block.timestamp;
      await expect(tokenVeZOIC.createLock(amount, BigNumber.from(lockTime)))
        .to.emit(tokenVeZOIC, "Deposit")
        .withArgs(
          owner.address,
          amount,
          BigNumber.from(Math.floor(lockTime / week) * week),
          0,
          (x: BigNumber) => {
            createLockTime = x.toNumber() + 5 * 60;
            return x.gt(block.timestamp);
          }
        )
        .to.emit(tokenVeZOIC, "Supply")
        .withArgs(0, amount);

      const lockBalance = await tokenVeZOIC.lockedBalanceOf(owner.address);
      expect(lockBalance.amount).to.equal(amount);
      expect(lockBalance.end).to.equal(
        BigNumber.from(Math.floor(lockTime / week) * week)
      );

      //check veToken balance
      const veTokenBalance: BigNumber = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        createLockTime
      );
      // console.log('veTokenBalance', veTokenBalance.toString());
      expect(veTokenBalance).not.eq(0);

      const totalAmount = amount.add(amount2);

      expect(await tokenZOIC.balanceOf(tokenVeZOIC.address)).to.equal(amount);
      expect(await tokenZOIC.balanceOf(owner.address)).to.equal(amount2);

      //increase amount
      await expect(tokenVeZOIC.increaseAmount(amount2))
        .to.emit(tokenVeZOIC, "Deposit")
        .withArgs(owner.address, amount2, lockBalance.end, 2, (x: BigNumber) =>
          x.gt(block.timestamp)
        )
        .to.emit(tokenVeZOIC, "Supply")
        .withArgs(amount, totalAmount);

      //check lock balance
      const lockBalance2 = await tokenVeZOIC.lockedBalanceOf(owner.address);
      expect(lockBalance2.amount).to.equal(totalAmount);
      expect(lockBalance2.end).to.equal(lockBalance.end);

      //check token balance
      expect(await tokenZOIC.balanceOf(tokenVeZOIC.address)).to.equal(
        totalAmount
      );

      expect(await tokenZOIC.balanceOf(owner.address)).to.equal(0);

      //check veToken balance
      const veTokenBalance2: BigNumber = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        createLockTime
      );
      // console.log('veTokenBalance2', veTokenBalance2.toString());
      expect(veTokenBalance2).eq(veTokenBalance.mul(2));
    });
  });

  describe("increaseUnlockTime", () => {
    let amount: BigNumber = ethers.utils.parseEther("100");
    let snapshotId: string;
    beforeEach(async () => {
      snapshotId = await ethers.provider.send("evm_snapshot", []);
      const [owner] = await ethers.getSigners();
      //mint 100 token
      await tokenCoffer
        .connect(owner)
        .withdrawERC20(tokenZOIC.address, owner.address, amount);
    });
    afterEach(async () => {
      await ethers.provider.send("evm_revert", [snapshotId]);
    });

    it("should success", async () => {
      const [owner] = await ethers.getSigners();

      const week = 7 * 24 * 60 * 60;
      const lockTime = Math.floor(new Date().getTime() / 1000) + week;
      await tokenZOIC.approve(tokenVeZOIC.address, amount);

      //get block timestamp
      const block = await ethers.provider.getBlock("latest");

      let createLockTime = block.timestamp;
      await expect(tokenVeZOIC.createLock(amount, BigNumber.from(lockTime)))
        .to.emit(tokenVeZOIC, "Deposit")
        .withArgs(
          owner.address,
          amount,
          BigNumber.from(Math.floor(lockTime / week) * week),
          0,
          (x: BigNumber) => {
            createLockTime = x.toNumber() + 5 * 60;
            return x.gt(block.timestamp);
          }
        )
        .to.emit(tokenVeZOIC, "Supply")
        .withArgs(0, amount);

      const lockBalance = await tokenVeZOIC.lockedBalanceOf(owner.address);
      expect(lockBalance.amount).to.equal(amount);
      expect(lockBalance.end).to.equal(
        BigNumber.from(Math.floor(lockTime / week) * week)
      );

      //check veToken balance
      const veTokenBalance: BigNumber = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        createLockTime
      );
      // console.log('veTokenBalance', veTokenBalance.toString());
      expect(veTokenBalance).not.eq(0);

      //increase unlock time
      const newLockTime = lockTime + week;
      await expect(tokenVeZOIC.increaseUnlockTime(newLockTime))
        .to.emit(tokenVeZOIC, "Deposit")
        .withArgs(
          owner.address,
          0,
          BigNumber.from(Math.floor(newLockTime / week) * week),
          3,
          (x: BigNumber) => {
            return x.gt(block.timestamp);
          }
        )
        .to.emit(tokenVeZOIC, "Supply")
        .withArgs(amount, amount);

      //check lock balance
      const lockBalance2 = await tokenVeZOIC.lockedBalanceOf(owner.address);
      expect(lockBalance2.amount).to.equal(amount);
      expect(lockBalance2.end).to.equal(
        BigNumber.from(Math.floor(newLockTime / week) * week)
      );

      //check veToken balance
      const veTokenBalance2: BigNumber = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        createLockTime
      );
      // console.log('veTokenBalance2', veTokenBalance2.toString());
      expect(veTokenBalance2).gt(veTokenBalance.mul(2));
    });
  });

  describe("totalSupply", () => {
    let amount: BigNumber = ethers.utils.parseEther("100");
    let snapshotId: string;

    beforeEach(async () => {
      snapshotId = await ethers.provider.send("evm_snapshot", []);
      const [owner] = await ethers.getSigners();
      //mint token
      await tokenCoffer
        .connect(owner)
        .withdrawERC20(tokenZOIC.address, owner.address, amount);
    });
    afterEach(async () => {
      await ethers.provider.send("evm_revert", [snapshotId]);
    });
    it("should 2 users create lock", async () => {
      const [owner, addr1] = await ethers.getSigners();

      const week = 7 * 24 * 60 * 60;
      const lockTime = Math.floor(new Date().getTime() / 1000) + week * 10;

      //mint token to addr1
      await tokenCoffer
        .connect(owner)
        .withdrawERC20(tokenZOIC.address, addr1.address, amount);

      //get block timestamp
      const block = await ethers.provider.getBlock("latest");

      //owner create lock
      await tokenZOIC.connect(owner).approve(tokenVeZOIC.address, amount);
      await tokenVeZOIC
        .connect(owner)
        .createLock(amount, BigNumber.from(lockTime));

      const balanceOfOwner = await tokenVeZOIC.balanceOfAtTime(
        owner.address,
        block.timestamp + week
      );
      let totalSupply = await tokenVeZOIC.totalSupplyAtTime(
        block.timestamp + week
      );

      expect(balanceOfOwner).to.equal(totalSupply);

      //addr1 create lock
      await tokenZOIC.connect(addr1).approve(tokenVeZOIC.address, amount);
      await tokenVeZOIC
        .connect(addr1)
        .createLock(amount, BigNumber.from(lockTime));

      const balanceOfAddr1 = await tokenVeZOIC.balanceOfAtTime(
        addr1.address,
        block.timestamp + week
      );
      totalSupply = await tokenVeZOIC.totalSupplyAtTime(block.timestamp + week);

      expect(totalSupply).to.equal(balanceOfOwner.add(balanceOfAddr1));

      const totalSupplyNow = await tokenVeZOIC.totalSupply();
      expect(totalSupplyNow).to.gt(totalSupply);
    });
  });
});
