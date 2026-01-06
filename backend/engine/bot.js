const { PlayerState } = require("./player");
const PokerOdds = require("poker-odds-calculator");
const OddsCalculator = PokerOdds.OddsCalculator || (PokerOdds.default && PokerOdds.default.OddsCalculator);
const CardGroup = PokerOdds.CardGroup || (PokerOdds.default && PokerOdds.default.CardGroup);

class BotBrain {
    static decide(botPlayer, gameState, difficulty = 'medium') {
        if (!gameState.handInProgress) return { action: 'CHECK' };

        // Gather data
        const currentTableBet = gameState.currentBet || 0;
        const botCurrentBet = botPlayer.currentBet || 0;
        const callAmount = currentTableBet - botCurrentBet;
        const potTotal = gameState.pot[0].total; // total money in main pot
        
        // Calculate pot odds
        const potOdds = (potTotal + callAmount) > 0 
            ? (callAmount / (potTotal + callAmount)) * 100 
            : 0;

        // Get equity
        let equity = botPlayer.equity || 0;
        
        if (!equity && botPlayer.hand && botPlayer.hand.length === 2) {
             equity = this.getSimpleEquity(botPlayer.hand);
        }

        const rng = Math.random(); 
        let decision = { action: 'FOLD' };

        console.log(`🤖 ${botPlayer.name} Eq:${equity.toFixed(1)}% | PotOdds:${potOdds.toFixed(1)}% | RNG:${rng.toFixed(2)}`);

        // Case A: equity > 80%
        if (equity > 80) {
            // 20% Trap
            if (rng < 0.20 && callAmount === 0) {
                 decision = { action: 'CHECK' };
            } else if (rng < 0.20 && callAmount > 0) {
                 decision = { action: 'CALL' };
            } else {
                 // 80% Aggressive value bet
                 decision = this.determineRaise(gameState, botPlayer, 0.85); 
            }
        }

        // Case B: equity 60% - 80%
        else if (equity > 60) {
            if (callAmount > 0) {
                // If facing a bet: Call 70%, Raise 30%
                decision = rng < 0.70 ? { action: 'CALL' } : this.determineRaise(gameState, botPlayer, 0.5);
            } else {
                // If checked to us: Bet 50% pot
                decision = this.determineRaise(gameState, botPlayer, 0.5);
            }
        }

        // Case C: equity 35% - 60%
        else if (equity > 35) {
             if (equity >= potOdds) {
                  // 20% Semi-bluff raise
                  if (rng < 0.20) decision = this.determineRaise(gameState, botPlayer, 0.5);
                  else decision = { action: 'CALL' };
             } else {
                  // 10% Float
                  if (rng < 0.10 && callAmount < (botPlayer.stack * 0.1)) {
                        decision = { action: 'CALL' };
                  } else {
                        decision = { action: 'FOLD' };
                  }
             }
        }

        // Case D: equity <= 35%
        else {
             if (callAmount === 0) {
                  // 15% Bluff Bet with nothing
                  if (rng < 0.15) decision = this.determineRaise(gameState, botPlayer, 0.33); 
                  else decision = { action: 'CHECK' };
             } else {
                  // 5% Reraise bluff
                  if (rng < 0.05 && callAmount < (botPlayer.stack * 0.2)) {
                        console.log(`🤖 ${botPlayer.name} attempting STONE COLD BLUFF`);
                        decision = this.determineRaise(gameState, botPlayer, 0.75);
                  } else {
                        decision = { action: 'FOLD' };
                  }
             }
        }

        // Ensures bot doesn't make illegal moves
        
        if (decision.action === 'CHECK' && callAmount > 0) {
            decision.action = 'CALL';
        }
        if (decision.action === 'CALL' && callAmount === 0) {
            decision.action = 'CHECK';
        }
        if (decision.action === 'FOLD' && callAmount === 0) {
            decision.action = 'CHECK';
        }
        if (decision.action === 'RAISE') {
             const maxTotal = botPlayer.stack + botCurrentBet;
             if (decision.amount > maxTotal) decision.amount = maxTotal;
        }

        return decision;
    }

    static determineRaise(gameState, botPlayer, percentOfPot) {
        const minRaise = gameState.minRaiseAmount || 0;
        const currentTableBet = gameState.currentBet || 0;
        const potSize = gameState.pot[0].total;
        
        // The absolute maximum chips the bot can put in
        const maxChips = botPlayer.stack + (botPlayer.currentBet || 0);
        const minLegalRaiseTotal = currentTableBet + minRaise;

        if (maxChips > currentTableBet && maxChips < minLegalRaiseTotal) {
            return { action: 'RAISE', amount: maxChips };
        }

        let addedChips = Math.floor(potSize * percentOfPot);
        let targetTotal = currentTableBet + addedChips;

        // Minimum raise requirement
        if (targetTotal < minLegalRaiseTotal) {
             targetTotal = minLegalRaiseTotal;
        }

        // Cap at All-In
        if (targetTotal >= maxChips) {
             targetTotal = maxChips; 
        }

        return { action: 'RAISE', amount: targetTotal };
    }

    static getSimpleEquity(hand) {
         const r1 = this.getRank(hand[0]);
         const r2 = this.getRank(hand[1]);
         if (r1 === r2) return 60 + (r1 * 2);
         return 40 + r1 + r2;
    }

    static getRank(card) {
        if (!card) return 0;
        let r = typeof card === 'string' ? card.slice(0, -1) : (card.rank || card.value);
        if (r === "A") return 14;
        if (r === "K") return 13;
        if (r === "Q") return 12;
        if (r === "J") return 11;
        if (r === "T") return 10;
        return parseInt(r) || 0;
    }
}

module.exports = BotBrain;