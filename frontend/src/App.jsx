import { useEffect, useState } from "react";
import { io } from "socket.io-client";

// Ensure this matches your server URL exactly
const socket = io("http://localhost:3000");

// Simple seat positions for a 6-max table (percentages relative to table container)
const POSITIONS = [
  { bottom: "5%", left: "50%", transform: "translateX(-50%)" }, // Hero (Bottom)
  { top: "50%", left: "5%", transform: "translateY(-50%)" },    // Left
  { top: "5%", left: "20%" },                                    // Top Left
  { top: "5%", right: "20%" },                                   // Top Right
  { top: "50%", right: "5%", transform: "translateY(-50%)" },   // Right
  { bottom: "5%", right: "20%" }                                 // Bot Right
];

const getCardDisplay = (card) => {
  // 1. Handle "Ghost" cards or nulls
  if (!card) return { rank: "?", suit: "?", color: "text-black" };

  let rank = "?";
  let suitRaw = "?";

  // 2. CHECK: Is the card a String? (e.g., "Ah", "Td", "2s")
  if (typeof card === 'string') {
      // The suit is always the last character
      suitRaw = card.slice(-1); 
      // The rank is everything before the last character
      rank = card.slice(0, -1); 
  } 
  // 3. Fallback: Is the card an Object? (e.g., { rank: "A", suit: "h" })
  else if (typeof card === 'object') {
      rank = card.rank || card.value || "?";
      suitRaw = card.suit || card.type || "?";
  }

  // 4. Map letters to Symbols
  const suitMap = {
    'h': '♥', 'd': '♦', 'c': '♣', 's': '♠',
    'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠'
  };
  
  const suitSymbol = suitMap[suitRaw] || suitRaw;
  
  // 5. Determine Color
  const color = ['♥', '♦'].includes(suitSymbol) ? "text-red-600" : "text-black";

  return { rank, suit: suitSymbol, color };
};

export default function App() {
  const [gameState, setGameState] = useState(null);
  const [mySeat, setMySeat] = useState(null);
  const [inputName, setInputName] = useState("Player" + Math.floor(Math.random()*1000));

  useEffect(() => {
    socket.on("connect", () => console.log("Connected", socket.id));
    
    socket.on("state", (state) => {
      setGameState(state);
    });
    
    socket.on("joined", ({ seatIndex }) => {
      setMySeat(seatIndex);
    });

    // Handle game over or errors
    socket.on("error", (msg) => alert("Error: " + msg));

    return () => socket.off();
  }, []);

  const handleJoin = () => {
    socket.emit("join", { name: inputName, stack: 1000 });
  };

  const handleStartHand = () => {
    socket.emit("start-hand");
  };

  const handleAction = (action, amount = 0) => {
    if (!gameState || mySeat === null) return;
    const player = gameState.players[mySeat];
    socket.emit("action", { name: player.name, action, amount });
  };

  // Wait for connection
  if (!gameState) return <div className="text-white font-bold text-2xl p-10">Connecting to server...</div>;

  // Helper to check if it's my turn
  const isMyTurn = gameState.currentPlayer === mySeat;
  const isHandInProgress = gameState.handInProgress;
  
  // Calculate minimum valid bet (Call amount + Min Raise)
  // Note: This is a simplified frontend calculation. Ideally server sends valid actions.
  const myPlayer = gameState.players[mySeat];
  const callAmount = myPlayer ? gameState.currentBet - myPlayer.currentBet : 0;
  const minRaise = gameState.minRaiseAmount || gameState.bigBlind || 10;
  const minBetAmount = (gameState.currentBet || 0) + minRaise;

  return (
    <div className="bg-zinc-900 h-screen w-screen relative overflow-hidden text-white font-bold selection:bg-none">
      
      {/* --- HUD / DEBUG INFO --- */}
      <div className="absolute top-0 left-0 bg-black/50 p-4 text-xs z-50 pointer-events-none">
        <div>Stage: <span className="text-green-400 uppercase">{gameState.stage}</span></div>
        <div>Pot: <span className="text-yellow-400">${gameState.pot.reduce((a,b)=>a+b.total, 0)}</span></div>
        <div>Current Bet: ${gameState.currentBet}</div>
        <div>Min Raise: ${gameState.minRaiseAmount}</div>
      </div>

      {/* --- THE TABLE --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[800px] aspect-[2/1] bg-green-800 rounded-[200px] border-[12px] border-green-950 shadow-2xl relative">
        
        {/* TABLE CENTER (Logo / Community Cards) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
          
          {/* LOGO / WAITING MESSAGE */}
          {!isHandInProgress && (
            <div className="text-green-900/50 text-4xl font-black tracking-widest pointer-events-none">
              POKERWYN
            </div>
          )}

          {/* COMMUNITY CARDS */}
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

          {/* POT DISPLAY */}
          {gameState.pot[0]?.total > 0 && (
            <div className="bg-black/60 px-4 py-1 rounded-full text-yellow-400 border border-yellow-400/30">
              Total Pot: ${gameState.pot.reduce((a,b)=>a+b.total, 0)}
            </div>
          )}
        </div>

        {/* PLAYERS LOOP */}
        {gameState.players.map((player, serverIndex) => {
          if (player.state === "LEFT") return null;

          // ROTATION LOGIC: 
          const offset = mySeat !== null ? mySeat : 0;
          const displayIndex = (serverIndex - offset + POSITIONS.length) % POSITIONS.length;
          const style = POSITIONS[displayIndex] || { top: 0, left: 0 };

          const isActing = gameState.currentPlayer === serverIndex;
          const isWinner = false; // You can add logic for winner highlighting later

          return (
            <div key={serverIndex} className="absolute flex flex-col items-center w-24 transition-all duration-300" style={style}>
              
              {/* AVATAR CIRCLE */}
              <div className={`
                w-16 h-16 rounded-full flex items-center justify-center border-4 bg-gray-800 relative z-10
                ${isActing ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] scale-110' : 'border-gray-600'}
                ${player.state === 'FOLDED' ? 'opacity-50 grayscale' : ''}
              `}>
                <span className="text-xs truncate max-w-[90%]">{player.name}</span>
                
                {/* DEALER BUTTON (Calculated based on server index) */}
                {gameState.buttonIndex === serverIndex && (
                  <div className="absolute -right-2 -bottom-1 w-6 h-6 bg-white text-black text-[10px] rounded-full flex items-center justify-center border-2 border-gray-300 shadow-sm font-bold">D</div>
                )}
              </div>

              {/* STACK BUBBLE */}
              <div className="bg-black/80 px-3 py-0.5 rounded-full -mt-2 border border-gray-700 text-sm z-20 font-mono text-green-400">
                ${player.stack}
              </div>
              
              {/* CARDS (Only show mine or if revealed) */}
              <div className="flex -mt-8 gap-1 z-0 transition-transform hover:-translate-y-2">
                {player.hand && player.hand.length > 0 && (
                    (mySeat === serverIndex || !isHandInProgress) ? (
                      player.hand.map((c, i) => {
                        const { rank, suit, color } = getCardDisplay(c);
                        return (
                          <div key={i} className={`w-10 h-14 bg-white ${color} text-sm border rounded shadow-md flex items-center justify-center`}>
                              {rank}{suit}
                          </div>
                        );
                      })
                    ) : (
                      // Card Backs
                      <>
                        <div className="w-10 h-14 bg-blue-800 border-2 border-white/20 rounded shadow-md"></div>
                        <div className="w-10 h-14 bg-blue-800 border-2 border-white/20 rounded shadow-md -ml-6"></div>
                      </>
                    )
                )}
              </div>
              
              {/* CURRENT ROUND BET BUBBLE */}
              {player.currentBet > 0 && (
                <div className="absolute -top-8 text-yellow-400 font-bold drop-shadow-md text-lg animate-bounce">
                  +${player.currentBet}
                </div>
              )}

              {/* ACTION TEXT (e.g. "CHECK") - You can add this state in backend later */}
              {player.state === 'FOLDED' && <div className="text-red-500 font-bold text-xs mt-1">FOLD</div>}
              {player.isAllIn && <div className="text-red-600 font-black text-xs mt-1 animate-pulse">ALL IN</div>}
            </div>
          );
        })}
      </div>

      {/* --- CONTROLS AREA --- */}
      <div className="absolute bottom-0 w-full p-6 flex justify-center items-end h-32 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex gap-4">
          
          {/* JOIN FORM (If not seated) */}
          {mySeat === null ? (
            <div className="flex gap-2 bg-black/50 p-4 rounded-xl border border-white/10 backdrop-blur-md">
              <input 
                className="text-black px-4 py-2 rounded font-bold outline-none focus:ring-2 focus:ring-green-500" 
                value={inputName} 
                onChange={e=>setInputName(e.target.value)}
                placeholder="Enter Name"
              />
              <button onClick={handleJoin} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold transition-colors">
                JOIN TABLE
              </button>
            </div>
          ) : (
            // GAME CONTROLS
            <>
              {/* START HAND BUTTON (Only if waiting) */}
              {!isHandInProgress && gameState.players.filter(p=>p.state!=='LEFT').length >= 2 && (
                <button onClick={handleStartHand} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl shadow-lg font-bold text-xl animate-pulse">
                  DEAL HAND
                </button>
              )}

              {/* ACTION BUTTONS (Only if my turn) */}
              {isHandInProgress && isMyTurn && (
                <div className="flex gap-3 animate-in slide-in-from-bottom-10 fade-in duration-300">
                  <button 
                    onClick={() => handleAction("FOLD")} 
                    className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-xl shadow-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 font-bold"
                  >
                    FOLD
                  </button>
                  
                  <button 
                    onClick={() => handleAction(callAmount > 0 ? "CALL" : "CHECK")} 
                    className="bg-yellow-600 hover:bg-yellow-500 text-white px-8 py-4 rounded-xl shadow-lg border-b-4 border-yellow-800 active:border-b-0 active:translate-y-1 font-bold"
                  >
                    {callAmount > 0 ? `CALL $${callAmount}` : "CHECK"}
                  </button>

                  <button 
                    onClick={() => handleAction("BET", minRaise)} 
                    className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-xl shadow-lg border-b-4 border-green-800 active:border-b-0 active:translate-y-1 font-bold"
                  >
                    RAISE TO ${minBetAmount}
                  </button>
                  {/* Note: A slider would be needed here for variable bet sizing */}
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}