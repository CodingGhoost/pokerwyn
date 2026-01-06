import { useState, useEffect, useRef } from 'react';

export default function ChatWindow({ messages, onSendMessage, currentPlayer }) {
    const [isOpen, setIsOpen] = useState(true);
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom on new message
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        onSendMessage(inputText);
        setInputText("");
    };

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="pointer-events-auto bg-black/80 backdrop-blur-md border border-white/20 text-white rounded-t-xl px-4 py-2 text-sm font-bold shadow-2xl hover:bg-black/90 transition-all flex items-center gap-2"
            >
                💬 Chat
                {messages.length > 0 && (
                    <span className="bg-red-500 text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {messages.length > 9 ? '9+' : messages.length}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className="pointer-events-auto w-72 h-[350px] flex flex-col bg-black/80 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div 
                className="bg-white/5 px-4 py-2 border-b border-white/10 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => setIsOpen(false)}
            >
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Table Chat</span>
                <span className="text-gray-400 hover:text-white">▼</span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {messages.map((msg) => {
                    const isSystem = msg.type === 'system';
                    const isMe = msg.sender === currentPlayer?.name;

                    return (
                        <div key={msg.id} className={`flex flex-col ${isSystem ? 'items-center' : 'items-start'}`}>
                            {!isSystem && (
                                <span className={`text-[10px] font-bold mb-0.5 ${isMe ? 'text-blue-400' : 'text-yellow-500'}`}>
                                    {msg.sender}
                                </span>
                            )}
                            <div className={`
                                max-w-[90%] text-sm px-2 py-1 rounded
                                ${isSystem ? 'text-gray-400 text-xs italic bg-transparent' : 'bg-white/10 text-gray-200'}
                            `}>
                                {msg.text}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-2 border-t border-white/10 bg-black/20">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
                />
            </form>
        </div>
    );
}