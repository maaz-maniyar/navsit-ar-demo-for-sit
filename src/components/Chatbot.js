import React, { useState } from "react";

function Chatbot({ setShowAR, setPath }) {
    const [message, setMessage] = useState("");
    const [chatHistory, setChatHistory] = useState([
        { sender: "bot", text: "Hi! 👋 I can help you navigate or answer questions. Where would you like to go or what would you like to ask?" }
    ]);
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!message.trim()) return;
        const userMessage = message.trim();
        setChatHistory((prev) => [...prev, { sender: "user", text: userMessage }]);
        setMessage("");
        setLoading(true);

        try {
            const res = await fetch("http://localhost:8080/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessage }),
            });

            if (!res.ok) throw new Error("Backend error");
            const data = await res.json();

            if (data.type === "navigation") {
                setChatHistory((prev) => [
                    ...prev,
                    { sender: "bot", text: `Navigating to ${data.destination}...` }
                ]);
                setPath(data.path);
                setShowAR(true);
            } else if (data.type === "text") {
                setChatHistory((prev) => [
                    ...prev,
                    { sender: "bot", text: data.reply }
                ]);
            } else {
                setChatHistory((prev) => [
                    ...prev,
                    { sender: "bot", text: "I'm not sure how to respond to that." }
                ]);
            }
        } catch (err) {
            console.error(err);
            setChatHistory((prev) => [
                ...prev,
                { sender: "bot", text: "Oops! Couldn't reach the server. Please try again." }
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                background: "linear-gradient(180deg, #1a1a1a 0%, #121212 100%)",
                color: "white",
                fontFamily: "Poppins, sans-serif",
                padding: "1rem",
                position: "relative",
            }}
        >
            {/* Header section */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1rem",
                }}
            >
                <h2 style={{ color: "#4CAF50", margin: 0 }}>NavSIT</h2>
                <img
                    src="/assets/SITLogo.jpg"
                    alt="SIT Logo"
                    style={{
                        height: "45px",
                        width: "45px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        boxShadow: "0 0 10px rgba(0,0,0,0.4)"
                    }}
                />
            </div>

            {/* Chat area */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    borderRadius: "10px",
                    padding: "1rem",
                    background: "rgba(255,255,255,0.05)",
                    boxShadow: "0 0 10px rgba(0,0,0,0.3)",
                }}
            >
                {chatHistory.map((msg, idx) => (
                    <div
                        key={idx}
                        style={{
                            textAlign: msg.sender === "user" ? "right" : "left",
                            margin: "0.5rem 0"
                        }}
                    >
                        <span
                            style={{
                                display: "inline-block",
                                background: msg.sender === "user" ? "#4CAF50" : "#333",
                                padding: "0.7rem 1rem",
                                borderRadius: "15px",
                                maxWidth: "70%",
                                color: "white"
                            }}
                        >
                            {msg.text}
                        </span>
                    </div>
                ))}
                {loading && <p style={{ opacity: 0.6 }}>Thinking...</p>}
            </div>

            {/* Input bar */}
            <div style={{ display: "flex", marginTop: "1rem" }}>
                <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Type your message..."
                    style={{
                        flex: 1,
                        padding: "0.8rem",
                        borderRadius: "20px",
                        border: "none",
                        outline: "none",
                        background: "#222",
                        color: "white"
                    }}
                />
                <button
                    onClick={handleSend}
                    style={{
                        marginLeft: "0.5rem",
                        padding: "0.8rem 1.2rem",
                        borderRadius: "20px",
                        background: "#4CAF50",
                        color: "white",
                        border: "none",
                        cursor: "pointer"
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    );
}

export default Chatbot;
