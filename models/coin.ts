export type AgentActionType = 
  | 'BUYBACK' 
  | 'BURN' 
  | 'AIRDROP_SOL' 
  | 'AIRDROP_TOKENS' 
  | 'TREASURY_SOL' 
  | 'TREASURY_TOKENS';

export interface Coin {
  mint: string;
  creator_wallet: string;
  owner_wallet?: string; // Wallet that owns this agent (if authenticated during launch)
  treasury_wallet?: string;
  treasury_fee_percentage?: number; // Percentage of claimed fees to send to treasury (0-100, default: 0)
  private_key: string;
  name: string;
  symbol: string;
  description: string;
  image_url: string;
  agent_id: string;
  status: 'active' | 'paused';
  next_round: Date;
  round_interval_minutes: number; // 1-10 minutes, default 10
  model?: string; // AI model display name (haiku 4.5, opus 4.5, sonnet 4.5, grok 3.0, gpt 5.2, gemini)
  forced_next_action?: string; // Force agent to do specific action on next round (for testing/debugging)
  enabled_actions: {
    buyback: boolean;
    burn: boolean;
    airdrop_sol: boolean;
    airdrop_tokens: boolean;
    treasury_sol: boolean;
    treasury_tokens: boolean;
  };
  stats: {
    fees_claimed: number;
    buyback_sol: number;
    burned_tokens: number;
    airdropped_sol: number;
    airdropped_tokens: number;
    sent_to_treasury_sol: number;
    sent_to_treasury_tokens: number;
    sent_to_treasury_from_fees: number; // SOL sent to treasury from automatic fee splits
    rounds: number;
  };
  consecutive_rounds_no_fees?: number; // Track rounds with no fees for auto-pause
  market_cap?: number; // Current market cap in USD
  agent_sol_balance?: number; // Agent wallet SOL balance
  agent_token_balance?: number; // Agent wallet token balance
  created_at: Date;
  updated_at: Date;
}

// Helper to convert enabled_actions object to AgentActionType array
export function getEnabledActionTypes(enabledActions: Coin['enabled_actions']): AgentActionType[] {
  const actions: AgentActionType[] = [];
  if (enabledActions.buyback) actions.push('BUYBACK');
  if (enabledActions.burn) actions.push('BURN');
  if (enabledActions.airdrop_sol) actions.push('AIRDROP_SOL');
  if (enabledActions.airdrop_tokens) actions.push('AIRDROP_TOKENS');
  if (enabledActions.treasury_sol) actions.push('TREASURY_SOL');
  if (enabledActions.treasury_tokens) actions.push('TREASURY_TOKENS');
  return actions;
}
