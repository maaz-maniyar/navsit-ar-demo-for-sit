import React, { useState } from "react";
import ARView from "./ARView";

function Chatbot() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [pathData, setPathData] = useState(null);

    const handleSend = async () => {
        if (!input) return;

        setMessages(prev => [...prev, { sender: "user", text: input }]);

        if (input.toLowerCase().includes("navigate")) {
            // fetch mock backend JSON
            const res = await fetch("/mockPath.json");
            const data = await res.json();
            setPathData(data);

            setMessages(prev => [
                ...prev,
                { sender: "bot", text: "Starting navigation..." }
            ]);
        } else {
            setMessages(prev => [
                ...prev,
                { sender: "bot", text: "I can help you navigate the campus 😄" }
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
