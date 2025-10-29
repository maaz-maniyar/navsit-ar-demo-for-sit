import React, { useState } from "react";
import { BASE_URL } from "../config";

function Chatbot({ onNavigationStart }) {
    const [message, setMessage] = useState("");
    const [chatHistory, setChatHistory] = useState([
        {
            sender: "bot",
            text: "Hi! 👋 I can help you navigate or answer questions. Where would you like to go or what would you like to ask?"
        }
    ]);
    const [loading, setLoading] = useState(false);

    const getLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) reject("Geolocation not supported");
            else {
                navigator.geolocation.getCurrentPosition(
                    (pos) =>
                        resolve({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude
                        }),
                    (err) => reject(err)
                );
            }
        });
    };

    const handleSend = async () => {
        if (!message.trim()) return;

        const userMessage = message.trim();
        setChatHistory((prev) => [...prev, { sender: "user", text: userMessage }]);
        setMessage("");
        setLoading(true);

        try {
            const coords = await getLocation().catch(() => null);
            const res = await fetch(`${BASE_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    latitude: coords?.latitude,
                    longitude: coords?.longitude
                })
            });

            if (!res.ok) throw new Error("Backend error");
            const data = await res.json();
            const botReply = data.reply || "I'm not sure how to respond.";

            // Add bot reply
            setChatHistory((prev) => [...prev, { sender: "bot", text: botReply }]);

            // If backend returned path & coordinates => start navigation
            if (Array.isArray(data.coordinates) && data.coordinates.length > 1) {
                // The backend returns coordinates as [[lat,lng], [lat,lng], ...]
                const [lat, lng] = data.coordinates[1]; // pick the next node after user's current node
                const nextCoords = { lat, lng };
                const payload = {
                    nextCoords,
                    path: data.path || null,
                    nextNode: data.nextNode || null,
                    reply: botReply
                };

                // Give state a moment then switch to AR mode via callback from App
                setTimeout(() => {
                    if (typeof onNavigationStart === "function") onNavigationStart(payload);
                }, 300);
            }
        } catch (err) {
            console.error(err);
            setChatHistory((prev) => [
                ...prev,
                {
                    sender: "bot",
                    text: "Oops! Couldn't reach the server. Please try again."
                }
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
                position: "relative"
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1rem"
                }}
            >
                <h2 style={{ color: "#4CAF50", margin: 0 }}>NavSIT</h2>
                <img
                    src="/SITLogo.jpg"
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
                    boxShadow: "0 0 10px rgba(0,0,0,0.3)"
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
                    color: "white",
                    wordWrap: "break-word"
                }}
            >
              {msg.text}
            </span>
                    </div>
                ))}
                {loading && <p style={{ opacity: 0.6 }}>Thinking...</p>}
            </div>

            {/* Input */}
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
                    disabled={loading}
                >
                    {loading ? "..." : "Send"}
                </button>
            </div>
        </div>
    );
}

export default Chatbot;
