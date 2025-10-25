import React, { useState } from "react";

function Chatbot({ setShowAR, setPath }) {
    const [input, setInput] = useState("");

    const handleSend = async () => {
        const command = input.trim().toLowerCase();
        if (command.startsWith("navigate to")) {
            const location = command.replace("navigate to", "").trim();

            // Fetch path data
            const res = await fetch("/mockPath.json");
            const data = await res.json();

            if (data[location]) {
                setPath(data[location]); // Send the array of coordinates
                setShowAR(true);
            } else {
                alert("Location not found in mockPath.json");
            }
        }
        setInput("");
    };

    return (
        <div style={{ padding: 20 }}>
            <input
                type="text"
                value={input}
                placeholder="Type 'Navigate to ECE Block'"
                onChange={(e) => setInput(e.target.value)}
                style={{ width: "80%", padding: 8 }}
            />
            <button onClick={handleSend} style={{ padding: 8, marginLeft: 10 }}>
                Send
            </button>
        </div>
    );
}

export default Chatbot;
