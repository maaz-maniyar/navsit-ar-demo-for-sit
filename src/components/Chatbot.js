import React, { useState } from "react";
import { BASE_URL } from "../config";

function Chatbot({ setShowAR, setNextNodeCoords }) {
    const [message, setMessage] = useState("");
    const [chatHistory, setChatHistory] = useState([
        {
            sender: "bot",
            text: "Hi! I can help you navigate or answer questions. Where would you like to go or what would you like to ask?"
        }
    ]);
    const [loading, setLoading] = useState(false);

    const [pendingNavigation, setPendingNavigation] = useState(null);

    const getLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) reject("Geolocation not supported");
            else {
                navigator.geolocation.getCurrentPosition(
                    (pos) =>
                        resolve({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                        }),
                    (err) => reject(err)
                );
            }
        });
    };

    const extractEntity = (msg) => {
        const lower = msg.toLowerCase();
        if (lower.includes("ece")) return "ECE Block";
        if (lower.includes("cse")) return "CSE Department";
        if (lower.includes("front gate")) return "SIT Front Gate";
        if (lower.includes("mba")) return "MBA Block";
        if (lower.includes("civil")) return "Civil Department";
        if (lower.includes("library")) return "SIT Library";
        if (lower.includes("canteen")) return "SIT Canteen";
        return null;
    };

    const handleSend = async () => {
        if (!message.trim()) return;

        const userMessage = message.trim();
        setChatHistory((prev) => [...prev, { sender: "user", text: userMessage }]);
        setMessage("");
        setLoading(true);

        try {
            const coords = await getLocation().catch(() => null);

            const res = await fetch(`${BASE_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    latitude: coords?.latitude,
                    longitude: coords?.longitude,
                }),
            });

            if (!res.ok) throw new Error("Backend error");
            const data = await res.json();

            setChatHistory((prev) => [...prev, { sender: "bot", text: data.reply }]);

            const replyLower = data.reply.toLowerCase();
            if (replyLower.includes("tap navigate") || replyLower.includes("start the ar")) {
                const entity = extractEntity(userMessage);
                if (entity) {
                    setPendingNavigation({ entity });
                }
            }

            if (data.nextNode && data.coordinates) {
                setNextNodeCoords(data.coordinates);
                setShowAR(true);
            }

        } catch (err) {
            console.error(err);
            setChatHistory((prev) => [
                ...prev,
                { sender: "bot", text: "Oops! Couldn't reach the server. Try again." },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const startNavigation = async () => {
        if (!pendingNavigation?.entity) return;

        const coords = await getLocation().catch(() => null);

        const res = await fetch(`${BASE_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: pendingNavigation.entity,
                latitude: coords?.latitude,
                longitude: coords?.longitude,
            }),
        });

        const data = await res.json();

        if (data.nextNode && data.coordinates) {
            setNextNodeCoords(data.coordinates);
            setShowAR(true);
        }

        setPendingNavigation(null);
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
                    src="/SITLogo.jpg"
                    alt="SIT Logo"
                    style={{
                        height: "45px",
                        width: "45px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        boxShadow: "0 0 10px rgba(0,0,0,0.4)",
                    }}
                />
            </div>

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
                            margin: "0.5rem 0",
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
                            }}
                        >
                            {msg.text}
                        </span>
                    </div>
                ))}
                {loading && <p style={{ opacity: 0.6 }}>Thinking...</p>}
            </div>

            {pendingNavigation && (
                <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                    <button
                        onClick={startNavigation}
                        style={{
                            padding: "0.8rem 1.5rem",
                            background: "#4CAF50",
                            color: "white",
                            borderRadius: "10px",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "16px",
                        }}
                    >
                        Start Navigation
                    </button>
                </div>
            )}

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
                        color: "white",
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
                        cursor: "pointer",
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
