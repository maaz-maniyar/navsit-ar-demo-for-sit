import React, { useState } from "react";
import ARView from "./ARView";

function Chatbot() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [pathData, setPathData] = useState(null);

    const handleSend = async () => {
        if (!input) return;

        // Add user message
        setMessages(prev => [...prev, { sender: "user", text: input }]);

        // Check if input contains "navigate"
        if (input.toLowerCase().includes("navigate")) {
            try {
                const res = await fetch("/mockPath.json"); // fetch from public folder
                if (!res.ok) throw new Error("HTTP error " + res.status);
                const data = await res.json();

                // Update state for pathData (AR)
                setPathData(data);

                // Bot response
                setMessages(prev => [
                    ...prev,
                    { sender: "bot", text: "Starting navigation..." }
                ]);
            } catch (err) {
                console.error("Failed to fetch mockPath:", err);
                setMessages(prev => [
                    ...prev,
                    { sender: "bot", text: "Failed to start navigation 😢" }
                ]);
            }
        } else {
            // For other messages
            setMessages(prev => [
                ...prev,
                { sender: "bot", text: "I don't understand 😕" }
            ]);
        }

        setInput("");
    };


    return (
        <div style={{ fontFamily: "Arial", width: "400px", margin: "20px auto" }}>
            <h2 style={{ textAlign: "center" }}>NavSIT Chatbot</h2>
            <div style={{ height: "300px", overflowY: "auto", border: "1px solid #ddd", padding: "10px", backgroundColor: "white" }}>
                {messages.map((m, i) => (
                    <div key={i} style={{ textAlign: m.sender === "user" ? "right" : "left", margin: "10px 0" }}>
                        <b>{m.sender === "user" ? "You" : "Bot"}:</b> {m.text}
                    </div>
                ))}
            </div>
            <div style={{ marginTop: "10px", display: "flex" }}>
                <input
                    style={{ flex: 1, padding: "8px", border: "1px solid #ccc", borderRadius: "5px" }}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask me something..."
                />
                <button
                    style={{ marginLeft: "10px", padding: "8px 15px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
                    onClick={handleSend}
                >
                    Send
                </button>
            </div>

            {pathData && <ARView pathData={pathData} />}
        </div>
    );
}

export default Chatbot;
