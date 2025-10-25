import React, { useState } from "react";

const Chatbot = ({ setShowAR, setPath }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");

    const handleSend = async () => {
        const userMsg = { text: input, sender: "user" };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);

        if (input.toLowerCase().includes("navigate to ece block")) {
            try {
                const res = await fetch("/mockPath.json");
                const data = await res.json();
                setPath(data); // Pass the path data to ARView
                setShowAR(true);
            } catch (error) {
                console.error("Failed to load mockPath.json", error);
            }
        } else {
            newMessages.push({ text: "Type 'Navigate to ECE Block' to begin AR mode.", sender: "bot" });
            setMessages([...newMessages]);
        }

        setInput("");
    };

    return (
        <div style={{ textAlign: "center", marginTop: "40px" }}>
            <h2>Campus Navigator</h2>
            <div
                style={{
                    border: "1px solid #ccc",
                    width: "90%",
                    margin: "10px auto",
                    padding: "10px",
                    height: "50vh",
                    overflowY: "auto",
                    borderRadius: "10px",
                    background: "#f9f9f9",
                }}
            >
                {messages.map((msg, idx) => (
                    <p
                        key={idx}
                        style={{
                            textAlign: msg.sender === "user" ? "right" : "left",
                            color: msg.sender === "user" ? "blue" : "green",
                        }}
                    >
                        {msg.text}
                    </p>
                ))}
            </div>
            <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                style={{
                    width: "70%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                }}
            />
            <button
                onClick={handleSend}
                style={{
                    padding: "8px 16px",
                    marginLeft: "10px",
                    background: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                }}
            >
                Send
            </button>
        </div>
    );
};

export default Chatbot;
