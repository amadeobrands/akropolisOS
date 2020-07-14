import { 
    FreeDAIContract, FreeDAIInstance,
    MintableTokenContract, MintableTokenInstance,
    PoolContract, PoolInstance, 
    PTokenContract, PTokenInstance, 
    FundsModuleStubContract, FundsModuleStubInstance,
    CErc20StubContract, CErc20StubInstance,
    CompoundModuleContract, CompoundModuleInstance,
    RAYStubContract, RAYStubInstance,
    RAYModuleContract, RAYModuleInstance,
    YTokenStubContract, YTokenStubInstance,
    CurveFiTokenStubContract, CurveFiTokenStubInstance,
    CurveFiSwapStubContract, CurveFiSwapStubInstance,
    CurveFiDepositStubContract, CurveFiDepositStubInstance,
    CurveFiYModuleContract, CurveFiYModuleInstance,
    IDefiModuleInstance
} from "../types/truffle-contracts/index";

// tslint:disable-next-line:no-var-requires
const { BN, constants, expectEvent, expectRevert, shouldFail, time } = require("@openzeppelin/test-helpers");
// tslint:disable-next-line:no-var-requires
const should = require("chai").should();
var expect = require("chai").expect;
const w3random = require("./utils/w3random");
const expectEqualBN = require("./utils/expectEqualBN");

const FreeDAI = artifacts.require("FreeDAI");
const MintableToken = artifacts.require("MintableToken");
const Pool = artifacts.require("Pool");
const PToken = artifacts.require("PToken");
const FundsModuleStub = artifacts.require("FundsModuleStub");
const CErc20Stub = artifacts.require("CErc20Stub");
const CompoundModule = artifacts.require("CompoundModule");
const RAYStub = artifacts.require("RAYStub");
const RAYModule = artifacts.require("RAYModule");
const YTokenStub = artifacts.require("YTokenStub");
const CurveFiSwapStub = artifacts.require("CurveFiSwapStub");
const CurveFiDepositStub = artifacts.require("CurveFiDepositStub");
const CurveFiTokenStub = artifacts.require("CurveFiTokenStub");
const CurveFiYModule = artifacts.require("CurveFiYModule");
const BN1E18 = (new BN('10')).pow(new BN(18));


describe("DeFi modules", function(){
    let modulesToTest = [
        {module: "CompoundModule", 
            before: async function(token:FreeDAIInstance, pool:PoolInstance, owner:string):Promise<[IDefiModuleInstance, string, BN]>{
                let cToken: CErc20StubInstance;
                let defi: CompoundModuleInstance;

                cToken = await CErc20Stub.new();
                await (<any> cToken).methods['initialize(address)'](token.address, {from: owner});

                defi = await CompoundModule.new();
                await (<any> defi).methods['initialize(address)'](pool.address, {from: owner});

                await defi.registerToken(token.address, cToken.address, {from: owner});

                let interesRate = await cToken.INTEREST_RATE();

                return [defi, cToken.address, interesRate];
            },
            protocolBalanceOf: async function(defiModuleAddress:string, protocolAddress:string, tokenAddress:string):Promise<BN> {
                let protocol = await CErc20Stub.at(protocolAddress);
                let balance = await protocol.balanceOf(defiModuleAddress);
                return balance;
            },
            underlyingBalanceOf: async function(defiModuleAddress:string, protocolAddress:string, tokenAddress:string):Promise<BN> {
                let protocol = await CErc20Stub.at(protocolAddress);
                let balance = await protocol.getBalanceOfUnderlying(defiModuleAddress);
                return balance;
            }
        },
        {module: "RAYModule", 
            before: async function(token:FreeDAIInstance, pool:PoolInstance, owner:string):Promise<[IDefiModuleInstance, string, BN]>{
                let ray: RAYStubInstance;
                let defi: RAYModuleInstance;

                ray = await RAYStub.new();
                await (<any> ray).methods['initialize(address)'](token.address, {from: owner});
                await pool.set('ray', ray.address, false, {from: owner});

                defi = await RAYModule.new();
                await (<any> defi).methods['initialize(address)'](pool.address, {from: owner});

                await defi.registerToken(token.address, web3.utils.keccak256("DaiCompound"), {from: owner});

                let interesRate = await ray.INTEREST_RATE();

                return [defi, ray.address, interesRate];
            },
            protocolBalanceOf: async function(defiModuleAddress:string, protocolAddress:string, tokenAddress:string):Promise<BN> {
                // let protocol = RAYStub.at(protocolAddress);
                // let balance = await protocol.balanceOf(defiModuleAddress),
                // return balance;
                return this.underlyingBalanceOf(defiModuleAddress, protocolAddress, tokenAddress);
            },
            underlyingBalanceOf: async function(defiModuleAddress:string, protocolAddress:string, tokenAddress:string):Promise<BN> {
                const portfolioID = '0xcd93cf275bcc8c600887dc587ea0a16e8f0a87fa7f99560f72186069c8d3b3df'; //web3.utils.keccak256("DaiCompound");
                let protocol = await RAYStub.at(protocolAddress);
                let rayModule = await RAYModule.at(defiModuleAddress);
                let tokenData = await <any>rayModule.tokens(tokenAddress);
                //console.log('tokenData', tokenData);
                let rayTokenId:string = tokenData.rayTokenId;
                //console.log('rayTokenId', rayTokenId);
                if(rayTokenId == '0x0000000000000000000000000000000000000000000000000000000000000000') return new BN(0);
                let balances = await protocol.getTokenValueStub(rayTokenId);
                return balances[0];
            }
        },   
        {module: "Curve.Fi yDAI/yUSDC/yUSDT", 
            before: async function(token:FreeDAIInstance, pool:PoolInstance, owner:string):Promise<[IDefiModuleInstance, string, BN]>{
                let usdc, usdt: FreeDAIInstance;
                let yDAI, yUSDC, yUSDT: YTokenStubInstance;
                let curveFiSwap: CurveFiSwapStubInstance;
                let curveFiDeposit: CurveFiDepositStubInstance;
                let defi: CurveFiYModuleInstance;

                yDAI = await YTokenStub.new();
                await (<any> yDAI).methods['initialize(address,string,uint8)'](token.address, "DAI", 18, {from: owner});

                usdc = await MintableToken.new();
                await (<any> usdc).methods['initialize(string,uint8)']("USDC", 6, {from: owner});
                yUSDC = await YTokenStub.new();
                await (<any> yDAI).methods['initialize(address,string,uint8)'](token.address, "USDC", 6, {from: owner});

                usdt = await MintableToken.new();
                await (<any> usdt).methods['initialize(string,uint8)']("USDT", 6, {from: owner});
                yUSDT = await YTokenStub.new();
                await (<any> yDAI).methods['initialize(address,string,uint8)'](token.address, "USDT", 6, {from: owner});

                curveFiSwap = await CurveFiSwapStub.new();
                await (<any> curveFiSwap).methods['initialize(address[3])']([token.address, usdc.address, usdt.address], {from: owner});
                await pool.set('curveFiSwap', curveFiSwap.address, false, {from: owner});
                curveFiDeposit = await CurveFiDepositStub.new();
                await (<any> curveFiDeposit).methods['initialize(address)'](curveFiSwap.address, {from: owner});
                await pool.set('curveFiDeposit', curveFiDeposit.address, false, {from: owner});

                defi = await CurveFiYModule.new();
                await (<any> defi).methods['initialize(address)'](pool.address, {from: owner});

                await defi.setCurveFi(curveFiDeposit.address);

                let interesRate = await yDAI.INTEREST_RATE();

                return [defi, yDAI.address, interesRate];
            },
            protocolBalanceOf: async function(defiModuleAddress:string, protocolAddress:string, tokenAddress:string):Promise<BN> {
                //TODO: correct calculations
                return this.underlyingBalanceOf(defiModuleAddress, protocolAddress, tokenAddress);
            },
            underlyingBalanceOf: async function(defiModuleAddress:string, protocolAddress:string, tokenAddress:string):Promise<BN> {
                //let yDAI = await YTokenStub.at(protocolAddress);
                let dai = await MintableToken.at(tokenAddress);
                return await dai.balanceOf(protocolAddress);
            }
        }   
    ];

    modulesToTest.forEach(function(moduleDef){
        contract(moduleDef.module, async ([_, owner, user, ...otherAccounts]) => {
            let dai: FreeDAIInstance;
            let pool: PoolInstance;
            let pToken: PTokenInstance;
            let funds: FundsModuleStubInstance;
            let defim: IDefiModuleInstance;
            let defiProtocolAddress: string;
          
            // Interest in tests can be calculated as (interesRate/expScale)*(secondsPassed/annualSeconds)
            let interesRate:BN, expScale = new BN('1000000000000000000'), annualSeconds = new BN(365*24*60*60+(24*60*60/4));

            before(async () => {
                //Setup "external" contracts
                dai = await FreeDAI.new();
                await (<any> dai).methods['initialize()']({from: owner});

                //Setup system contracts
                pool = await Pool.new();
                await (<any> pool).methods['initialize()']({from: owner});

                pToken = await PToken.new();
                await (<any> pToken).methods['initialize(address)'](pool.address, {from: owner});

                funds = await FundsModuleStub.new();
                await (<any> funds).methods['initialize(address)'](pool.address, {from: owner});

                [defim, defiProtocolAddress, interesRate] = await moduleDef.before(dai, pool, owner);

                await pool.set('ptoken', pToken.address, false, {from: owner});
                await pool.set('funds', funds.address, false, {from: owner});
                await pool.set('defi', defim.address, false, {from: owner});
                await pToken.addMinter(funds.address, {from: owner});
                await (<any> defim).addDefiOperator(funds.address, {from: owner});
                await funds.registerLToken(dai.address, BN1E18, {from: owner});
            });

            it("should deposit DAI", async () => {
                let amount = w3random.interval(100, 1000, 'ether');
                await (<any> dai).methods['mint(uint256)'](amount, {from: user});

                let before = {
                    userDai: await dai.balanceOf(user),
                    protocolDai: await dai.balanceOf(defiProtocolAddress),
                    defimProtocolBalance: await moduleDef.protocolBalanceOf(defim.address, defiProtocolAddress, dai.address),
                    defimUnderlyingBalance: await moduleDef.underlyingBalanceOf(defim.address, defiProtocolAddress, dai.address),
                };

                await dai.transfer(defim.address, amount, {from: user});
                let receipt = await defim.handleDeposit(dai.address, user, amount, {from: owner});
                expectEvent(receipt, 'Deposit', {'amount':amount});

                let after = {
                    userDai: await dai.balanceOf(user),
                    protocolDai: await dai.balanceOf(defiProtocolAddress),
                    defimProtocolBalance: await moduleDef.protocolBalanceOf(defim.address, defiProtocolAddress, dai.address),
                    defimUnderlyingBalance: await moduleDef.underlyingBalanceOf(defim.address, defiProtocolAddress, dai.address),
                };

                expect(after.userDai).to.be.bignumber.eq(before.userDai.sub(amount));
                expect(after.protocolDai).to.be.bignumber.eq(before.protocolDai.add(amount));
                expect(after.defimProtocolBalance).to.be.bignumber.gt(before.defimProtocolBalance);
                expectEqualBN(after.defimUnderlyingBalance, before.defimUnderlyingBalance.add(amount), 18, -6); //Accuracy may be bad because of rounding and time passed

            });

            it("should withdraw DAI", async () => {
                let before = {
                    userDai: await dai.balanceOf(user),
                    protocolDai: await dai.balanceOf(defiProtocolAddress),
                    defimProtocolBalance: await moduleDef.protocolBalanceOf(defim.address, defiProtocolAddress, dai.address),
                    defimUnderlyingBalance: await moduleDef.underlyingBalanceOf(defim.address, defiProtocolAddress, dai.address),
                };
                let amount = w3random.intervalBN(before.protocolDai.divn(3), before.protocolDai.divn(2));

                let receipt = await defim.withdraw(user, amount, {from: owner});
                expectEvent(receipt, 'Withdraw', {'amount':amount});

                let after = {
                    userDai: await dai.balanceOf(user),
                    protocolDai: await dai.balanceOf(defiProtocolAddress),
                    defimProtocolBalance: await moduleDef.protocolBalanceOf(defim.address, defiProtocolAddress, dai.address),
                    defimUnderlyingBalance: await moduleDef.underlyingBalanceOf(defim.address, defiProtocolAddress, dai.address),
                };

                expect(after.userDai).to.be.bignumber.eq(before.userDai.add(amount));
                expect(after.protocolDai).to.be.bignumber.eq(before.protocolDai.sub(amount));
                expect(after.defimProtocolBalance).to.be.bignumber.lt(before.defimProtocolBalance);
                expectEqualBN(after.defimUnderlyingBalance, before.defimUnderlyingBalance.sub(amount), 18, -5); //Accuracy may be bad because of rounding and time passed
            });

            it("should withdraw correct interest", async () => {
                let beforeTimeShift = {
                    userDai: await dai.balanceOf(user),
                    defimProtocolBalance: await moduleDef.protocolBalanceOf(defim.address, defiProtocolAddress, dai.address),
                    defimUnderlyingBalance: await moduleDef.underlyingBalanceOf(defim.address, defiProtocolAddress, dai.address),
                };
                expect(beforeTimeShift.defimUnderlyingBalance).to.be.bignumber.gt(new BN(0)); // Ensure we have some DAI on pool balance

                //Mint PTK
                let ptkForOwner = w3random.interval(50, 100, 'ether');
                let ptkForUser = w3random.interval(10, 50, 'ether');
                await funds.mintPTokens(owner, ptkForOwner, {from: owner});
                await funds.mintPTokens(user, ptkForUser, {from: owner});
                //console.log(ptkForUser, ptkForOwner);

                let timeShift = w3random.interval(30*24*60*60, 89*24*60*60)
                await time.increase(timeShift);
                await defim.claimDistributions(user);

                let beforeWithdrawInterest = {
                    userDai: await dai.balanceOf(user),
                    defimProtocolBalance: await moduleDef.protocolBalanceOf(defim.address, defiProtocolAddress, dai.address),
                    defimUnderlyingBalance: await moduleDef.underlyingBalanceOf(defim.address, defiProtocolAddress, dai.address),
                    availableInterest: (<any>(await defim.availableInterest(user))).amounts[0]
                };
                //console.log(beforeTimeShift.defimUnderlyingBalance, interesRate, timeShift, expScale, annualSeconds);
                let expectedFullInterest = beforeTimeShift.defimUnderlyingBalance.mul(interesRate).mul(timeShift).div(expScale).div(annualSeconds);
                expectEqualBN(beforeWithdrawInterest.defimUnderlyingBalance, beforeTimeShift.defimUnderlyingBalance.add(expectedFullInterest), 18, -5);
                let expectedUserInterest = expectedFullInterest.mul(ptkForUser).div(ptkForOwner.add(ptkForUser));

                expectEqualBN(beforeWithdrawInterest.availableInterest, expectedUserInterest, 18, -5);

                // await defim.claimDistributions(user, {from:user}); //This is not required, but useful to test errors

                let receipt = await defim.withdrawInterest({from: user});
                expectEvent(receipt, 'WithdrawInterest', {'account':user});

                let afterWithdrawInterest = {
                    userDai: await dai.balanceOf(user),
                    defimProtocolBalance: await moduleDef.protocolBalanceOf(defim.address, defiProtocolAddress, dai.address),
                    defimUnderlyingBalance: await moduleDef.underlyingBalanceOf(defim.address, defiProtocolAddress, dai.address),
                    availableInterest: (<any>(await defim.availableInterest(user))).amounts[0]
                };
                expectEqualBN(afterWithdrawInterest.userDai, beforeWithdrawInterest.userDai.add(expectedUserInterest), 18, -5);

                expectEqualBN(afterWithdrawInterest.availableInterest, new BN(0), 18, -5);


            });

        });

    });

});
