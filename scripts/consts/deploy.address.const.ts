import { hardhatArguments } from 'hardhat';
import { deployNetwork } from './deploy.const';

type ContractDeployAddress = string | null;

interface ContractDeployAddressInterface {
  XToken?: ContractDeployAddress;
  YToken?: ContractDeployAddress;
  StableTokenX?: ContractDeployAddress;
  TokenDeposit?: ContractDeployAddress;
  Greeter?: ContractDeployAddress;
  Treasury?: ContractDeployAddress;
}

const ContractDeployAddress_ETHTestNet: ContractDeployAddressInterface = {
  XToken: '0x9389023C56ed52f0Da18571500149d50430e7a1A',
  YToken: '0xa5bb1f61C8CFc133Bea27127565eB21B2C458CC3',
  StableTokenX: '0x51e49799490A4469fb73edFC09822b3b566cE445',
  TokenDeposit: '0x6550755AEE41CC87E72A849Fdf9022aa74DEC1F4',
  Greeter: null,
  Treasury: '0xB008F2B780d09Cf6F5bded95b27baB04f2ad40A7',
};

const ContractDeployAddress_ETHMainNet: ContractDeployAddressInterface = {};

export function getContractDeployAddress(
  network?: string
): ContractDeployAddressInterface {
  let _ContractDeployAddress: ContractDeployAddressInterface = null as any;
  switch (network) {
    case deployNetwork.eth_testnet:
      _ContractDeployAddress = ContractDeployAddress_ETHTestNet;
      break;
    case deployNetwork.eth_mainnet:
      _ContractDeployAddress = ContractDeployAddress_ETHMainNet;
      break;
    default:
      _ContractDeployAddress = undefined as any;
      break;
  }
  return _ContractDeployAddress;
}

export const ContractDeployAddress: ContractDeployAddressInterface =
  getContractDeployAddress(hardhatArguments?.network) as any;
