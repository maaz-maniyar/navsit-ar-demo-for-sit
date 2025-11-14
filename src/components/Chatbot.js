import React, { useState } from "react";
import { BASE_URL } from "../config";

function Chatbot({ setShowAR, setNextNodeCoords }) {
    const [message, setMessage] = useState("");
    const [chatHistory, setChatHistory] = useState([
        {
            sender: "bot",
            text: "Hi! I can help you navigate or answer questions. Where would you like to go or what would you like to ask?",
        },
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

    const startNavigation = async () => {
        if (!pendingNavigation?.entity) return;

        const entity = pendingNavigation.entity;

        // Build a proper NLP-friendly sentence
        const navigationQuery = `navigate to ${entity}`;

        const coords = await getLocation().catch(() => null);

        const res = await fetch(`${BASE_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: navigationQuery,
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

            const data = await res.json();

            if (data.reply && !data.nextNode && !data.coordinates) {
                setChatHistory((prev) => [
                    ...prev,
                    { sender: "bot", text: data.reply },
                ]);

                if (data.entity) {
                    setPendingNavigation({ entity: data.entity });
                }

                setLoading(false);
                return;
            }

            if (data.nextNode && data.coordinates) {
                setChatHistory((prev) => [
                    ...prev,
                    { sender: "bot", text: data.reply || "Starting navigation..." },
                ]);

                setNextNodeCoords(data.coordinates);
                setTimeout(() => {
                    setShowAR(true);
                }, 300);

                setPendingNavigation(null);
            } else {
                // General responses
                setChatHistory((prev) => [
                    ...prev,
                    { sender: "bot", text: data.reply },
                ]);
            }
        } catch (err) {
            console.error("Chat error:", err);
            setChatHistory((prev) => [
                ...prev,
                { sender: "bot", text: "Oops! Couldn't reach the server. Try again!" },
            ]);
        }

        setLoading(false);
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
            {/* Header */}
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

            {/* Start Navigation Button */}
            {pendingNavigation && (
                <button
                    onClick={startNavigation}
                    style={{
                        width: "100%",
                        padding: "1rem",
                        background: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "12px",
                        marginTop: "1rem",
                        fontSize: "1rem",
                    }}
                >
                    Start Navigation
                </button>
            )}

            {/* Input */}
            {/* Input Section */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.8rem 0",
                    marginTop: "0.5rem",
                    marginBottom: "1.5rem", // ⬅️ Lifts the whole input+button up
                }}
            >
                <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Type your message..."
                    style={{
                        flex: 1,
                        borderRadius: "20px",
                        padding: "0.8rem 1rem",
                        background: "#222",
                        color: "white",
                        border: "1px solid #333",
                        outline: "none",
                    }}
                />

                <button
                    onClick={handleSend}
                    disabled={loading}
                    style={{
                        border: "none",
                        padding: "0.8rem 1.2rem",
                        borderRadius: "20px",
                        background: "#4CAF50",
                        color: "white",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.6 : 1,
                        transition: "0.2s",
                    }}
                >
                    {loading ? "..." : "Send"}
                </button>
            </div>

        </div>
    );
}

export default Chatbot;
