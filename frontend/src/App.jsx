import { useEffect, useState, useRef } from "react";
import ChatWindow from './ChatWindow'; 
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

const POSITIONS = [
  // 0: Hero (bottom middle)
  { bottom: "3%", left: "50%", transform: "translateX(-50%)" },
  
  // 1: Bottom left inner
  { bottom: "3%", left: "25%" },
  
  // 2: Bottom left outer
  { bottom: "15%", left: "6%" },
  
  // 3: Top left outer
  { top: "20%", left: "3%" },
  
  // 4: Top left inner
  { top: "3%", left: "25%" },
    
  // 5: Top right inner
  { top: "3%", right: "25%" },
  
  // 6: Top right outer
  { top: "20%", right: "3%" },
  
  // 7: Bottom right outer
  { bottom: "15%", right: "6%" },
  
  // 8: Bottom right inner
  { bottom: "3%", right: "25%" }
];

const getCardDisplay = (card) => {
  if (!card) return { rank: "?", suit: "?", color: "text-black" };
  let rank = "?", suitRaw = "?";
  if (typeof card === 'string') { suitRaw = card.slice(-1); rank = card.slice(0, -1); } 
  else if (typeof card === 'object') { rank = card.rank || card.value || "?"; suitRaw = card.suit || card.type || "?"; }
  const suitMap = { 'h': '♥', 'd': '♦', 'c': '♣', 's': '♠', 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
  const suitSymbol = suitMap[suitRaw] || suitRaw;
  const color = ['♥', '♦'].includes(suitSymbol) ? "text-red-600" : "text-black";
  return { rank, suit: suitSymbol, color };
};

const SpeechBubble = ({ message, isBottom }) => {
  if (!message) return null;
  const bottomStyle = "top-[140%] after:bottom-full after:border-b-white after:border-t-transparent";
  const topStyle = "-top-16 after:top-full after:border-t-white after:border-b-transparent";
  const positionClasses = isBottom ? bottomStyle : topStyle;

  return (
    <div className={`absolute left-1/2 -translate-x-1/2 bg-white text-black font-bold px-4 py-2 rounded-xl shadow-xl z-50 whitespace-pre-line text-center leading-tight border-2 border-gray-300 min-w-max after:content-[''] after:absolute after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent ${positionClasses}`}>
      {message}
    </div>
  );
};

export default function App() {
  const [gameState, setGameState] = useState(null);
  const [mySeat, setMySeat] = useState(null);
  const [inputName, setInputName] = useState("Player" + Math.floor(Math.random()*1000));
  const [betAmount, setBetAmount] = useState(0);
  const [bubbles, setBubbles] = useState({});
  const [timeLeft, setTimeLeft] = useState(30);
  const [messages, setMessages] = useState([]);
  const [rebuyAmount, setRebuyAmount] = useState(1000);
  
  const prevStateRef = useRef(null);

  useEffect(() => {
    socket.on("connect", () => console.log("Connected", socket.id));
    
    // chat message listener
    socket.on("chatUpdate", (msg) => {
        setMessages(prev => [...prev, msg]);
    });

    socket.on("state", (newState) => {
      setGameState(newState);
      
      // chat sync history
      if (newState.chatMessages) {
          setMessages(newState.chatMessages);
      }
      
      const prev = prevStateRef.current;
      
      if (prev) {
        setBubbles(currentBubbles => {
            let newBubbles = { ...currentBubbles };
            
            const isNewHand = !prev.handInProgress && newState.handInProgress;
            if (isNewHand) {
                return {}; 
            }

            if (prev.stage !== newState.stage) {
                newBubbles = {};
            }

            if (newState.lastWinDetails && newState.lastWinDetails.length > 0) {
                newBubbles = {}; 
                newState.lastWinDetails.forEach((win) => {
                    const winnerIndex = newState.players.findIndex(p => p.name === win.name);
                    if (winnerIndex !== -1) {
                        newBubbles[winnerIndex] = `Wins $${win.amount}\n${win.desc}`;
                    }
                });
                return newBubbles;
            }
            
            newState.players.forEach((p, i) => {
                const prevP = prev.players[i];
                if (!prevP) return;

                if (prevP.state !== 'FOLDED' && p.state === 'FOLDED') {
                    newBubbles[i] = "Fold";
                }
                else if (!prevP.actedThisRound && p.actedThisRound && p.currentBet === prevP.currentBet) {
                    newBubbles[i] = "Check";
                }
                else if (p.currentBet > prevP.currentBet) {
                    if (isNewHand && newState.stage === 'preflop') {
                        const bb = newState.bigBlind || 10;
                        const sb = newState.smallBlind || 5;
                        if (p.currentBet === sb) newBubbles[i] = `Small Blind $${sb}`;
                        else if (p.currentBet === bb) newBubbles[i] = `Big Blind $${bb}`;
                    } else {
                        const prevTableBet = prev.currentBet || 0;
                        if (p.isAllIn && !prevP.isAllIn) newBubbles[i] = "All In!";
                        else if (p.currentBet > prevTableBet) {
                            if (prevTableBet === 0) newBubbles[i] = `Bets $${p.currentBet}`;
                            else newBubbles[i] = `Raises $${p.currentBet}`;
                        } 
                        else newBubbles[i] = "Call";
                    }
                }
            });

            return newBubbles;
        });
      }

      prevStateRef.current = newState; 
    });

    socket.on("joined", ({ seatIndex }) => setMySeat(seatIndex));
    socket.on("error", (msg) => alert("Error: " + msg));

    socket.on("tableReset", () => {
        setMySeat(null);      // Force back to spectator/join mode
        setGameState(null);   // Clear local state momentarily
        setMessages([]);      // Clear chat locally
        setBubbles({});       // Clear bubbles
    });
    
    // Clean up listeners
    return () => {
        socket.off();
        socket.off("chatUpdate");
    };
  }, []);

  useEffect(() => {
    if (gameState && mySeat !== null && gameState.currentPlayer === mySeat) {
      const minRaise = gameState.minRaiseAmount || gameState.bigBlind || 10;
      const currentTableBet = gameState.currentBet || 0;
      setBetAmount(currentTableBet + minRaise);
    }
  }, [gameState?.currentPlayer, mySeat]);

  useEffect(() => {
    if (gameState?.handInProgress && gameState?.currentPlayer !== -1) {
        setTimeLeft(30);
        const timerId = setInterval(() => {
            setTimeLeft((t) => Math.max(0, t - 1));
        }, 1000);
        return () => clearInterval(timerId);
    } else {
        setTimeLeft(0);
    }
  }, [gameState?.currentPlayer, gameState?.handInProgress]);

  const handleJoin = () => socket.emit("join", { name: inputName, stack: 1000 });
  const handleStartHand = () => socket.emit("start-hand");
  const handleAddBot = () => socket.emit("add-bot");

  const handleAction = (action, amount = 0) => {
    if (!gameState || mySeat === null) return;
    socket.emit("action", { name: gameState.players[mySeat].name, action, amount });
  };

  // chat handler
  const handleSendMessage = (text) => {
    const tableId = gameState?.id || 'default'; 
    socket.emit("sendChat", { tableId, text });
  };

  if (!gameState) return <div className="text-white font-bold text-2xl p-10">Connecting to server...</div>;

  const isMyTurn = gameState.currentPlayer === mySeat;
  const isHandInProgress = gameState.handInProgress;
  
  const myPlayer = gameState.players[mySeat];
  const currentTableBet = gameState.currentBet || 0;
  const myStack = myPlayer ? myPlayer.stack : 0;
  const myCurrentBet = myPlayer ? myPlayer.currentBet : 0;

  const minRaise = gameState.minRaiseAmount || gameState.bigBlind || 10;
  const minValidTotalBet = currentTableBet + minRaise;
  const maxValidTotalBet = myStack + myCurrentBet; 
  const canRaise = maxValidTotalBet > currentTableBet;
  const sliderMin = Math.min(minValidTotalBet, maxValidTotalBet);
  const sliderMax = maxValidTotalBet;
  const amountToCall = currentTableBet - myCurrentBet;
  const isCallAllIn = amountToCall >= myStack;

  const actingPlayer = gameState.currentPlayer !== -1 ? gameState.players[gameState.currentPlayer] : null;

  return (
    <div className="bg-zinc-900 h-screen w-screen relative overflow-hidden text-white font-bold selection:bg-none">
      
      {/* HUD */}
      <div className="absolute top-0 left-0 bg-black/50 p-4 text-xs z-50 pointer-events-none">
        <div>Stage: <span className="text-green-400 uppercase">{gameState.stage}</span></div>
        <div>Pot: <span className="text-yellow-400">${gameState.pot.reduce((a,b)=>a+b.total, 0)}</span></div>
        <div>Current Bet: ${currentTableBet}</div>
        <div>Min Raise: ${gameState.minRaiseAmount}</div>
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 z-50 flex gap-4">
        
        {/* Reset Table Button */}
        <button 
          onClick={() => {
            if(window.confirm("Are you sure? This will kick everyone and wipe the table.")) {
                socket.emit("resetTable");
            }
          }}
          className="bg-red-700 hover:bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg font-bold border-b-4 border-red-900 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2"
          title="Kick everyone and reset table"
        >
          <span>⚠️</span> RESET
        </button>

        {/* Add Bot Button*/}
        {!isHandInProgress && (
          <button 
            onClick={handleAddBot}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl shadow-lg font-bold border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2"
          >
            <span>🤖</span> ADD BOT
          </button>
        )}
      </div>

      {/* Left Side: Timer and Hand Stats */}
      {isHandInProgress && (
        <div className="fixed bottom-40 left-10 z-[100] flex flex-col-reverse gap-2 items-start pointer-events-none">
            {actingPlayer && (
                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="bg-black/80 backdrop-blur-md text-white border-2 border-yellow-500/50 rounded-xl px-6 py-3 shadow-2xl flex flex-col items-start min-w-[140px]">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Action On</span>
                        <span className="text-lg font-bold text-yellow-400 truncate max-w-[150px]">{actingPlayer.name}</span>
                        <div className="w-full h-1 bg-gray-700 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-yellow-500 transition-all duration-1000 ease-linear" style={{ width: `${(timeLeft / 30) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 mt-1 self-end">{timeLeft}s</span>
                    </div>
                </div>
            )}

            {myPlayer && myPlayer.handDescription && (
                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="bg-black/80 backdrop-blur-md text-white border-2 border-green-500/50 rounded-xl px-6 py-3 shadow-2xl flex flex-col items-start min-w-[140px]">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Current Hand</span>
                        <span className="text-xl font-bold text-green-400 whitespace-nowrap">{myPlayer.handDescription}</span>
                    </div>
                </div>
            )}

            {myPlayer && (typeof myPlayer.equity === 'number') && (
                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="bg-black/80 backdrop-blur-md text-white border-2 border-blue-500/50 rounded-xl px-6 py-3 shadow-2xl flex flex-col items-start gap-1 min-w-[140px]">
                        <div className="flex items-center justify-between w-full gap-4">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Win Equity</span>
                            <span className={`text-lg font-mono font-bold ${myPlayer.equity >= myPlayer.potOdds ? 'text-green-400' : 'text-red-400'}`}>
                                {myPlayer.equity}%
                            </span>
                        </div>
                        {myPlayer.potOdds > 0 && (
                            <div className="flex items-center justify-between w-full gap-4">
                                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Pot Odds</span>
                                <span className="text-lg font-mono font-bold text-yellow-400">
                                    {myPlayer.potOdds}%
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      )}

      {/* Right Side: Chat Window */}
      <div className="fixed bottom-36 right-6 z-[100] flex flex-col items-end pointer-events-none">
          <ChatWindow 
            messages={messages} 
            onSendMessage={handleSendMessage}
            currentPlayer={myPlayer}
          />
      </div>

      {/* Table */}
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-[1100px] aspect-[2.3/1] bg-green-800 rounded-[300px] border-[12px] border-green-950 shadow-2xl relative">
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
          {!isHandInProgress && <div className="text-green-900/50 text-4xl font-black tracking-widest pointer-events-none">POKERWYN</div>}
          <div className="flex gap-2 h-20">
            {gameState.communityCards.map((card, i) => {
                const { rank, suit, color } = getCardDisplay(card);
                return (
                  <div key={i} className={`w-14 h-20 bg-white ${color} rounded shadow-lg flex items-center justify-center border border-gray-300 text-xl font-bold`}>
                    {rank}{suit}
                  </div>
                );
            })}
          </div>
          {gameState.pot[0]?.total > 0 && (
            <div className="bg-black/60 px-4 py-1 rounded-full text-yellow-400 border border-yellow-400/30">
              Total Pot: ${gameState.pot.reduce((a,b)=>a+b.total, 0)}
            </div>
          )}
        </div>

        {gameState.players.map((player, serverIndex) => {
          if (player.state === "LEFT") return null;
          const offset = mySeat !== null ? mySeat : 0;
          const displayIndex = (serverIndex - offset + POSITIONS.length) % POSITIONS.length;
          const isActing = gameState.currentPlayer === serverIndex;
          const isBottom = [0, 1, 2, 7, 8].includes(displayIndex);
          const isHero = displayIndex === 0;
          const showCards = (player.hand && player.hand.length > 0 && (mySeat === serverIndex || player.showCards));

          return (
            <div key={serverIndex} className="absolute flex flex-col items-center w-24 transition-all duration-300" style={POSITIONS[displayIndex]}>
              <SpeechBubble message={bubbles[serverIndex]} isBottom={isBottom} />
              
              {/* Kick Bot Button */}
              {player.isBot && (
                <button
                    onClick={(e) => {
                    e.stopPropagation();
                    socket.emit('toggleBotKick', player.seatIndex);
                    }}
                    className={`absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center rounded-full shadow-md border-2 transition-all z-20 ${
                    player.kickPending 
                        ? "bg-gray-700 border-gray-500 hover:bg-gray-600" 
                        : "bg-red-600 border-red-800 hover:bg-red-500"
                    }`}
                    title={player.kickPending ? "Cancel Kick" : "Kick Bot after hand"}
                >
                    {player.kickPending ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    )}
                </button>
              )}

              {/* Leaving Soon Badge */}
              {player.kickPending && (
                <div className="absolute top-0 w-full text-center z-30 pointer-events-none">
                    <span className="bg-black/80 text-red-400 text-[10px] px-2 py-0.5 rounded-b font-bold uppercase tracking-wider shadow-sm border border-red-500/30">
                    LEAVING
                    </span>
                </div>
              )}
              
              <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 bg-gray-800 relative z-10 ${isActing ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] scale-110' : 'border-gray-600'} ${player.state === 'FOLDED' ? 'opacity-50 grayscale' : ''}`}>
                <span className="text-xs truncate max-w-[90%]">{player.name}</span>
                {gameState.buttonIndex === serverIndex && <div className="absolute -right-2 -bottom-1 w-6 h-6 bg-white text-black text-[10px] rounded-full flex items-center justify-center border-2 border-gray-300 shadow-sm font-bold">D</div>}
              </div>
              <div className="bg-black/80 px-3 py-0.5 rounded-full -mt-2 border border-gray-700 text-sm z-20 font-mono text-green-400">${player.stack}</div>
              <div className={`flex gap-1 z-0 transition-transform hover:-translate-y-2 ${isHero ? "-mt-2" : "-mt-2"}`}>
                {showCards ? 
                  player.hand.map((c, i) => <div key={i} className={`w-10 h-14 bg-white ${getCardDisplay(c).color} text-sm border rounded shadow-md flex items-center justify-center`}>{getCardDisplay(c).rank}{getCardDisplay(c).suit}</div>) : 
                  player.hand && player.hand.length > 0 && <><div className="w-10 h-14 bg-blue-800 border-2 border-white/20 rounded shadow-md"></div><div className="w-10 h-14 bg-blue-800 border-2 border-white/20 rounded shadow-md -ml-6"></div></>
                }
              </div>
              {player.state === 'FOLDED' && <div className="text-red-500 font-bold text-xs mt-1">FOLD</div>}
              {player.isAllIn && <div className="text-red-600 font-black text-xs mt-1 animate-pulse">ALL IN</div>}
            </div>
          );
        })}
      </div>

      {/* Bottom Middle Controls */}
      <div className="absolute bottom-0 w-full p-6 flex justify-center items-end h-32 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex gap-4">
          {mySeat === null ? (
            <div className="flex gap-2 bg-black/50 p-4 rounded-xl border border-white/10 backdrop-blur-md">
              <input 
                className="text-black px-4 py-2 rounded font-bold outline-none focus:ring-2 focus:ring-green-500" 
                value={inputName} 
                onChange={e => setInputName(e.target.value)} 
                placeholder="Enter Name" 
              />
              <button onClick={handleJoin} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold transition-colors">JOIN TABLE</button>
            </div>
          ) : (
            <>

              {/* Rebuy Button */}
              {!isHandInProgress && myPlayer && myPlayer.stack === 0 && (
                <div className="flex flex-col items-center gap-2 bg-black/80 p-3 rounded-xl border border-yellow-500/50 mb-2 animate-in fade-in slide-in-from-bottom-4 shadow-xl backdrop-blur-md">
                    <div className="text-yellow-400 font-black text-xs uppercase tracking-widest">BUSTED! REBUY?</div>
                    
                    <div className="flex items-center gap-2 w-full">
                        <span className="text-[10px] text-gray-400 font-mono">1</span>
                        <input 
                            type="range" 
                            min="1" 
                            max="1000" 
                            value={rebuyAmount} 
                            onChange={(e) => setRebuyAmount(Number(e.target.value))} 
                            className="w-32 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                        />
                        <span className="text-[10px] text-gray-400 font-mono">1k</span>
                    </div>

                    <button 
                        onClick={() => socket.emit("rebuy", { amount: rebuyAmount })} 
                        className="bg-yellow-600 hover:bg-yellow-500 text-white w-full py-1.5 rounded-lg font-bold text-sm shadow-lg border-b-2 border-yellow-800 active:border-b-0 active:translate-y-[2px] transition-all flex items-center justify-center gap-1"
                    >
                        <span>💰</span> ADD ${rebuyAmount}
                    </button>
                </div>
              )}

              {/* Show Cards Button */}
              {!isHandInProgress && myPlayer && myPlayer.hand && myPlayer.hand.length > 0 && !myPlayer.showCards && (
                <button 
                  onClick={() => socket.emit("showHand")} 
                  className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg shadow-lg font-bold text-sm mb-2 border border-gray-500 animate-in fade-in slide-in-from-bottom-2"
                >
                  👀 SHOW CARDS
                </button>
              )}

              {!isHandInProgress && gameState.players.filter(p => p.state !== 'LEFT').length >= 2 && (
                <button onClick={handleStartHand} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl shadow-lg font-bold text-xl animate-pulse pointer-events-auto">
                  DEAL HAND
                </button>
              )}

              {isHandInProgress && isMyTurn && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-10 fade-in duration-300">
                  {canRaise && (
                    <div className="flex items-center gap-2 bg-black/60 p-2 rounded-lg mb-1">
                      <span className="text-xs text-gray-400">MIN: {sliderMin}</span>
                      <input 
                        type="range" 
                        min={sliderMin} 
                        max={sliderMax} 
                        value={betAmount} 
                        onChange={(e) => setBetAmount(Number(e.target.value))} 
                        className="w-48 accent-green-500" 
                      />
                      <span className="text-xs text-gray-400">MAX: {sliderMax}</span>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleAction("FOLD")} 
                      className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-xl shadow-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 font-bold"
                    >
                      FOLD
                    </button>
                    
                    <button 
                      onClick={() => handleAction(amountToCall > 0 ? "CALL" : "CHECK")} 
                      className="bg-yellow-600 hover:bg-yellow-500 text-white px-8 py-4 rounded-xl shadow-lg border-b-4 border-yellow-800 active:border-b-0 active:translate-y-1 font-bold"
                    >
                      {amountToCall > 0 ? (isCallAllIn ? "CALL ALL-IN" : `CALL`) : "CHECK"}
                    </button>

                    {canRaise && (
                      <button 
                        onClick={() => {
                          if (betAmount >= maxValidTotalBet) {
                              handleAction("ALL_IN");
                          } else {
                              handleAction("BET", betAmount);
                          }
                        }} 
                        className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-xl shadow-lg border-b-4 border-green-800 active:border-b-0 active:translate-y-1 font-bold"
                      >
                        {betAmount >= maxValidTotalBet ? "ALL IN" : `RAISE TO $${betAmount}`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}