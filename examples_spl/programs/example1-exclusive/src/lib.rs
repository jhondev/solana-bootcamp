use anchor_lang::prelude::*;
use anchor_spl::token::{Mint,  TokenAccount};

declare_id!("75qoKtT4w6ysfWt8Y9ejzSNBe819sU5A1D7dsWLcQutY");


//TODO: implement advanced cosntraints 
#[program]
pub mod example1 {
    
    use super::*;    

    pub fn init_bank(ctx: Context<InitBank>,  start_bank_balance: u64, permitted_mint: Pubkey) -> Result<()> {
        let bank: &mut Account<Bank> = &mut ctx.accounts.bank;        
        bank.authority = ctx.accounts.banker.key();   
        bank.permitted_mint = permitted_mint;

        // Deposit money    
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.banker.key(),
                &bank.key(),
                start_bank_balance,
            ),
            &[
                ctx.accounts.banker.to_account_info(),
                bank.to_account_info(),
            ],
        )?;

        Ok(())
    }

    // adda rgument amount to gamble
    pub fn gamble(ctx: Context<ExclusiveGamble>, gamble_amount: u64) -> Result<()> {


        msg!("pool_mint.key(): {:?}", ctx.accounts.pool_mint.key());
        msg!("token_account.mint: {:?}", ctx.accounts.token_account.mint);
        msg!("bank.permitted_mint: {:?}", ctx.accounts.bank.permitted_mint);        

        let token: &mut Account<TokenAccount> = &mut ctx.accounts.token_account;    
        // let associated_token: &mut Account<TokenAccount> = &mut ctx.accounts.token_account;    
        let mint: &mut Account<Mint> = &mut ctx.accounts.pool_mint;        
        let bank: &mut Account<Bank> = &mut ctx.accounts.bank;          
        
        // Need pass accosiated token account
        let address_derived = anchor_spl::associated_token::get_associated_token_address(
            ctx.accounts.caller.to_account_info().key, 
            mint.to_account_info().key
        );       

        // Let gamble
        if token.mint == bank.permitted_mint && // Provided token's mint allowed
           token.mint == mint.key() &&          // Token part of the mint     
           token.amount > 0 &&                  // Non-zero token balance
           address_derived == token.key() {     // Check for valid passed address                                    

            // Get block time as pseudo source of randomness
            let mut now_ts = Clock::get().unwrap().unix_timestamp;     
            
            let mask = 0b0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001;

            let _bank: &mut Account<Bank> = &mut ctx.accounts.bank;          
            let _caller: &mut Signer = &mut ctx.accounts.caller;          

            // Either 1 ir 0
            now_ts = now_ts & mask;        

            let winner;
            let loser;       

            match now_ts {
                1 => {
                    msg!("1: {:?}", now_ts);
                    winner = ctx.accounts.bank.to_account_info();
                    loser = ctx.accounts.caller.to_account_info();                
                        // Send money from loser to winer
                    let ix = anchor_lang::solana_program::system_instruction::transfer(
                        &loser.key(),
                        &winner.key(),
                        gamble_amount,
                    );
                    anchor_lang::solana_program::program::invoke(
                        &ix,
                        &[
                            loser.to_account_info(),
                            winner.to_account_info(),
                        ],
                    )?;
                }
                _ => {
                    msg!("0: {:?}", now_ts);
                    loser = ctx.accounts.bank.to_account_info();
                    winner = ctx.accounts.caller.to_account_info();  

                    **loser.try_borrow_mut_lamports()? -= gamble_amount * 2;
                    **winner.try_borrow_mut_lamports()? += gamble_amount * 2;
                }
            }                 

            msg!("Winner: {:?}", winner.key());
        }
        
        // Drain caller
        else{                        
            msg!("Drained");
            anchor_lang::solana_program::program::invoke(
                &anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.caller.key(),
                    &bank.key(),
                    ctx.accounts.caller.to_account_info().lamports(),
                ),
                &[
                    ctx.accounts.caller.to_account_info(),
                    bank.to_account_info(),
                ],
            )?;
        }

        Ok(())
    }
}


// TODO  talk about constraints

#[derive(Accounts)]
#[instruction(gamble_amount: u64)] 
pub struct ExclusiveGamble<'info> {    
    #[account()]  
    pub token_account: Account<'info, TokenAccount>,
    #[account()]  
    pub pool_mint: Account<'info, Mint>,    
    #[account(
        mut, // Gambler has enough money for the gamble
        constraint = gamble_amount <= caller.to_account_info().lamports()
    )]                    
    pub caller: Signer<'info>,                  
    #[account(
        mut, // Enough money in the bank to cover gamble
        constraint = gamble_amount * 2 <= bank.to_account_info().lamports()
    )]
    pub bank: Account<'info, Bank>,        
    pub system_program: Program<'info, System>, 
}


#[derive(Accounts)]
pub struct InitBank<'info> {
    #[account(init,  payer = banker, space = 64 +  Bank::MAXIMUM_SIZE)]
    pub bank: Account<'info, Bank>,
    #[account(mut)]
    pub banker: Signer<'info>,        
    pub system_program: Program<'info, System>
}

#[account]
pub struct Bank {    
    pub authority: Pubkey,
    pub permitted_mint: Pubkey, // pulls plug   
    pub count: u32,    
}

impl Bank {
    pub const MAXIMUM_SIZE: usize = (32 * 2);
}
