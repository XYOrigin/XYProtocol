import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers, upgrades } from 'hardhat';

describe('TokenCENO', () => {
  let contract: Contract;

  const MINTER_ROLE = ethers.utils.solidityKeccak256(
    ['string'],
    ['MINTER_ROLE']
  );

  beforeEach(async () => {
    const TokenCENO = await ethers.getContractFactory('TokenCENO');
    contract = await upgrades.deployProxy(TokenCENO, []);
    await contract.deployed();
  });

  it('contract to be defined', async () => {
    expect(contract).to.be.instanceOf(Contract);
    expect(await contract.name()).to.equal('TokenCENO');
    expect(await contract.symbol()).to.equal('CENO');
    expect(await contract.decimals()).to.equal(18);
  });

  it('TokenCENO mint test', async () => {
    const [owner, signer] = await ethers.getSigners();

    const amount = ethers.utils.parseEther('100');

    await contract.connect(owner).mint(signer.address, amount);
    expect(await contract.balanceOf(signer.address)).to.equal(amount);

    await contract.mint(signer.address, amount);
    expect(await contract.balanceOf(signer.address)).to.equal(
      amount.add(amount)
    );

    await expect(
      contract.connect(signer).mint(signer.address, amount)
    ).to.revertedWith(
      `AccessControl: account ${ethers.utils
        .getAddress(signer.address)
        .toLowerCase()} is missing role ${MINTER_ROLE}`
    );
  });

  it('TokenCENO transfer test', async () => {
    const [owner, from, to] = await ethers.getSigners();
    const amount = ethers.utils.parseEther('100');
    const transferValue = ethers.utils.parseEther('50');

    await contract.connect(owner).mint(from.address, amount);
    expect(await contract.balanceOf(from.address)).to.equal(amount);

    const tx = await contract.connect(from).transfer(to.address, transferValue);
    const receipt = await tx.wait();

    expect(receipt.from).to.equal(from.address);
    expect(receipt.to).to.equal(contract.address);

    const gas = receipt.gasUsed.mul(tx.gasPrice);
    expect(gas).to.be.gt(ethers.utils.parseEther('0'));

    expect(await contract.balanceOf(to.address)).to.equal(transferValue);
    expect(await contract.balanceOf(from.address)).to.equal(
      amount.sub(transferValue)
    );

    await contract.connect(owner).pause();
    await expect(
      contract.connect(from).transfer(to.address, transferValue)
    ).to.be.revertedWith('Pausable: paused');
  });
});
