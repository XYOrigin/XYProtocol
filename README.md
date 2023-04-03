# XYProtocol contracts

## contract addresses

### eth mainnet

## how to develop and test

### Principle of development

#### TDD(Test-Driven Development)

The development process must strictly follow the principle of test-driven development, write test cases first, and then write the function implementation.

#### Code submission requires all test cases to pass

#### Incremental design

### Actual engineering development

#### Update With npm

```shell
git clone https://github.com/XYOrigin/XYProtocol.git
cd XYProtocol
npm install
```

The project structure is as follows

```bash
xyprotocol/
├── contracts          --- Contract source code directory, mainly store *.sol contract files
│   ├── HelloWorld.sol
│   └── ...
├── scripts            --- js script directory, mainly store deployment scripts.
│   ├── HelloWorld-deploy.js
│   └── ...
├── test               --- Contract unit test directory
│   ├── HelloWorld-test.js
│   └── ...
├── hardhat.config.js  --- hardhat configuration file
├── package.json
├── .env               --- Environment variable file (need to be created manually)
└── ...
```

## - Automated testing

Root directory add ```.env```  file 

```shell
ARBITRUM_TESTNET_URL='https://endpoints.omniatech.io/v1/arbitrum/goerli/public'
ARBITRUM_TESTNET_DEPLOYER_PRIVATE_KEY='0xddf32a25932****************************'
ETH_TESTNET_URL='https://rpc.ankr.com/eth_goerli'
ETH_TESTNET_DEPLOYER_PRIVATE_KEY='0xddf32a25932****************************'
ZKSYNC_ERA_TESTNET_URL="https://testnet.era.zksync.dev"
ZKSYNC_ERA_TESTNET_DEPLOYER_PRIVATE_KEY="0xddf32a25932****************************"
```

Running Test Locally (Recommend)

```shell
npx hardhat test
```

```shell
npx hardhat test --grep one
```

Running Test On Polygon Testnet

```shell
npx hardhat test --network mumbai
```

## Deployment

### Deploy contract to testnet or mainnet

```shell
npx hardhat run scripts/HelloWorld-deploy.ts --network mumbai
```

```shell
npx hardhat run --network bsc_testnet scripts/HelloWorld-deploy.ts
npx hardhat run --network bsc_testnet filePath
```

### Record the address of the contract after deployment

```shell
HelloWorld deployed to:0x3F0528D040f31ace17a0c733469145928b9C88a4
```

Record `0x3F0528D040f31ace17a0c733469145928b9C88a4` to any place you like, which is convenient for the `game-service-contract` service to call.

### Compile contract ABI

```shell
npm run compile
```

#### Generate contracts to the corresponding directory structure

````shell

```bash
contracts/
├── abi/
│   └── contracts/
│       ├── HelloWorld.sol/
│       │   ├── HelloWorld.json  ---abi description file
│       │   └── HelloWorld.ts    ---abi Typescript file
│       └── OtherXXX.sol/
│           ├── OtherXXX.json
│           └── OtherXXX.ts
└── ...
````

Copy the files in the `abi/` directory to the corresponding project for use

About the `abi/` directory, you can also use the `npm run compile` command to generate the `abi/` directory, and then copy the files in the `abi/` directory to the corresponding project for use.
