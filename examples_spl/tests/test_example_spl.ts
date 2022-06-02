import assert from "assert";
import { expect } from "chai";
import * as anchor from "@project-serum/anchor";
import {
  Account,
  createAccount,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  transfer,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, Keypair } from "@solana/web3.js";
import { Example1 } from "../target/types/example1";
const { SystemProgram } = anchor.web3;

describe("Exclusive gamble", async () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Example1 as anchor.Program<Example1>;
  const bank: Keypair = anchor.web3.Keypair.generate();
  const gambleAmoutLamport = 10000000;
  const wallet = anchor.Wallet.local();
  const LAMPORTS_PER_SOL = 1000000000;

  // Wallet callers
  const banker: Keypair = anchor.web3.Keypair.generate();
  const ownerOneNFT: Keypair = anchor.web3.Keypair.generate();
  const ownerTwoNFTs: Keypair = anchor.web3.Keypair.generate();
  const ownerZeroNFTs: Keypair = anchor.web3.Keypair.generate();
  const mintAuth: Keypair = anchor.web3.Keypair.generate();

  // NFT Collection 1
  ////////////////////////////////////////////////////////////////

  // Keypair for mint authority, can't have lamports
  const mintKeypair = anchor.web3.Keypair.generate();
  let mintAccount: PublicKey;

  // Token accounts
  let tokenAccount1: PublicKey;
  let tokenAccount2: PublicKey;
  let tokenAccount3: PublicKey;

  // Associated Token Accounts
  let member1ATA: Account;
  let member2ATA: Account;
  let member3ATA: Account;
  let memberOtherATA: Account;

  // ATAs
  let member1ATAInfo: Account;
  let member2ATAInfo: Account;
  let member3ATAInfo: Account;

  // NFT Collection 2
  ////////////////////////////////////////////////////////////////

  // New wallet
  const diffCollectionOwner = anchor.web3.Keypair.generate();

  // Mint accounts
  const mintAuth2 = anchor.web3.Keypair.generate();
  const mintKeypair2 = anchor.web3.Keypair.generate();

  let tokenAccount_mint2;
  let diffCollectionOwnerATA;

  let mintAccount2;

  // State helpers
  ////////////////////////////////////////////////////////////////
  async function topUp(
    accounts: Array<Keypair>,
    amount: number = 2 * LAMPORTS_PER_SOL
  ) {
    // Top-up each of the provided accounts
    for (var account of accounts) {
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(account.publicKey, amount)
      );
    }
  }

  // Feed ATA
  async function getBalance(ata: Account): Promise<Number> {
    return Number((await getAccount(provider.connection, ata.address)).amount);
  }

  // Create account
  async function createTokenAccount(
    payer: anchor.web3.Signer,
    mintAccount: anchor.web3.PublicKey,
    owner: anchor.web3.PublicKey
  ): Promise<PublicKey> {
    return await createAccount(
      provider.connection,
      payer,
      mintAccount,
      owner,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );
  }

  before(async () => {
    // Top-ups of all used accounts
    await topUp([
      banker,
      mintAuth,
      ownerOneNFT,
      ownerTwoNFTs,
      ownerZeroNFTs,
      diffCollectionOwner,
      mintAuth2,
    ]);

    // Mint for collection 1
    ////////////////////////////////////////////////////////////////

    // NFT mint with decimal 0 and supply of 1
    mintAccount = await createMint(
      provider.connection,
      mintAuth,
      mintAuth.publicKey,
      mintAuth.publicKey,
      0,
      mintKeypair,
      undefined,
      TOKEN_PROGRAM_ID
    );

    tokenAccount1 = await createTokenAccount(
      ownerOneNFT,
      mintAccount,
      ownerOneNFT.publicKey
    );
    tokenAccount2 = await createTokenAccount(
      ownerTwoNFTs,
      mintAccount,
      ownerTwoNFTs.publicKey
    );
    tokenAccount3 = await createTokenAccount(
      ownerZeroNFTs,
      mintAccount,
      ownerZeroNFTs.publicKey
    );

    // ATA for member 1
    member1ATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      ownerOneNFT,
      mintAccount,
      ownerOneNFT.publicKey
    );

    // ATA for member 2
    member2ATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      ownerTwoNFTs,
      mintAccount,
      ownerTwoNFTs.publicKey
    );

    // ATA for member 3
    member3ATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      ownerZeroNFTs,
      mintAccount,
      ownerZeroNFTs.publicKey
    );

    // ATA for other collection member
    memberOtherATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      diffCollectionOwner,
      mintAccount,
      diffCollectionOwner.publicKey
    );

    // Mint NFT to the ATA of member 1
    await mintTo(
      provider.connection,
      mintAuth,
      mintAccount,
      member1ATA.address,
      mintAuth,
      1,
      [],
      undefined,
      TOKEN_PROGRAM_ID
    );
    await mintTo(
      provider.connection,
      mintAuth,
      mintAccount,
      member2ATA.address,
      mintAuth,
      2,
      [],
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Mint for collection 2
    ////////////////////////////////////////////////////////////////

    // NFT mint with decimal 0 and supply of 1
    mintAccount2 = await createMint(
      provider.connection,
      mintAuth2,
      mintAuth2.publicKey,
      mintAuth2.publicKey,
      0,
      mintKeypair2,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Creates token account for mint 2
    tokenAccount_mint2 = await createTokenAccount(
      diffCollectionOwner,
      mintAccount2,
      diffCollectionOwner.publicKey
    );

    // ATA for diffCollectionOwner
    diffCollectionOwnerATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      diffCollectionOwner,
      mintAccount2,
      diffCollectionOwner.publicKey
    );

    // Mint NFT of a new collection
    await mintTo(
      provider.connection,
      mintAuth2,
      mintAccount2,
      diffCollectionOwnerATA.address,
      mintAuth2,
      1,
      [],
      undefined,
      TOKEN_PROGRAM_ID
    );
  });

  it("Initialise bank account", async () => {
    await program.methods
      .initBank(new anchor.BN(gambleAmoutLamport * 24), mintAccount)
      .accounts({
        bank: bank.publicKey,
        banker: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([bank])
      .rpc();

    // TODO: Sanity tests for checking balance
  });

  it("Both gambling outcomes are fulfilled", async () => {
    let gamblerWon = false;
    let gamblerLost = false;

    for (let i = 0; i < 20; i++) {
      let startBalanceBank: number = await provider.connection.getBalance(
        bank.publicKey
      );

      await provider.connection.confirmTransaction(
        await program.methods
          .gamble(new anchor.BN(gambleAmoutLamport))
          .accounts({
            tokenAccount: tokenAccount1,
            poolMint: mintAccount,
            caller: ownerOneNFT.publicKey,
            bank: bank.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([ownerOneNFT])
          .rpc()
      );

      let endBalanceBank: number = await provider.connection.getBalance(
        bank.publicKey
      );

      try {
        // Bank lose / gambler win scenario
        expect(gambleAmoutLamport * 2).to.equal(
          startBalanceBank - endBalanceBank
        );
        gamblerWon = true;
      } catch {
        // Bank win / gambler lose scenario
        expect(gambleAmoutLamport).to.equal(endBalanceBank - startBalanceBank);
        gamblerLost = true;
      }

      // Assert account is not drained
      assert(
        (await provider.connection.getBalance(ownerOneNFT.publicKey)) != 0
      );

      if (gamblerLost == true && gamblerWon == true) {
        break;
      }
    }
  });

  it("Can gamble with multiple NFTs", async () => {
    await provider.connection.confirmTransaction(
      await program.methods
        .gamble(new anchor.BN(gambleAmoutLamport))
        .accounts({
          tokenAccount: tokenAccount2,
          poolMint: mintAccount,
          caller: ownerTwoNFTs.publicKey,
          bank: bank.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([ownerTwoNFTs])
        .rpc()
    );

    // Assert account is not drained
    assert((await provider.connection.getBalance(ownerTwoNFTs.publicKey)) != 0);
  });

  it("Can't gamble without NFT", async () => {
    await provider.connection.confirmTransaction(
      await program.methods
        .gamble(new anchor.BN(gambleAmoutLamport))
        .accounts({
          tokenAccount: tokenAccount3,
          poolMint: mintAccount,
          caller: ownerZeroNFTs.publicKey,
          bank: bank.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([ownerZeroNFTs])
        .rpc()
    );

    member3ATAInfo = await getAccount(provider.connection, member3ATA.address);
    console.log("ownerZeroNFTs balance: ", member3ATAInfo.amount);

    // Assert account is drained
    assert(
      (await provider.connection.getBalance(ownerZeroNFTs.publicKey)) == 0
    );
  });

  it("Can gamble after receiving NFT", async () => {
    await topUp([ownerZeroNFTs]);
    await transfer(
      provider.connection,
      mintAuth,
      member1ATA.address,
      member3ATA.address,
      ownerOneNFT,
      1,
      [],
      undefined,
      TOKEN_PROGRAM_ID
    );

    member1ATAInfo = await getAccount(provider.connection, member1ATA.address);
    member2ATAInfo = await getAccount(provider.connection, member2ATA.address);
    member3ATAInfo = await getAccount(provider.connection, member3ATA.address);

    console.log("ownerOneNFT balance: ", member1ATAInfo.amount);
    console.log("ownerTwoNFTs balance: ", member2ATAInfo.amount);
    console.log("ownerZeroNFTs balance: ", member3ATAInfo.amount);

    await provider.connection.confirmTransaction(
      await program.methods
        .gamble(new anchor.BN(gambleAmoutLamport))
        .accounts({
          tokenAccount: tokenAccount3,
          poolMint: mintAccount,
          caller: ownerZeroNFTs.publicKey,
          bank: bank.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([ownerZeroNFTs])
        .rpc()
    );

    // Assert account is not drained
    assert(
      (await provider.connection.getBalance(ownerZeroNFTs.publicKey)) != 0
    );
  });

  it("Can't gamble with an NFT from a different collecion", async () => {
    console.log(
      "Start balance: ",
      await provider.connection.getBalance(diffCollectionOwner.publicKey)
    );

    // Assert no NFT from the old collection
    console.log(
      "await getBalance(diffCollectionOwnerATA)",
      await getBalance(diffCollectionOwnerATA)
    );
    console.log("await getBalance(member1ATA)", await getBalance(member1ATA));

    // Assert NFT from the new collection
    assert((await Number(await getBalance(diffCollectionOwnerATA))) > 0);

    await provider.connection.confirmTransaction(
      await program.methods
        .gamble(new anchor.BN(gambleAmoutLamport))
        .accounts({
          tokenAccount: tokenAccount_mint2,
          poolMint: mintAccount2,
          caller: diffCollectionOwner.publicKey,
          bank: bank.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([diffCollectionOwner])
        .rpc()
    );

    console.log(
      "End balance: ",
      await provider.connection.getBalance(diffCollectionOwner.publicKey)
    );

    // Assert account has been drained
    assert(
      (await provider.connection.getBalance(diffCollectionOwner.publicKey)) == 0
    );
  });
});
