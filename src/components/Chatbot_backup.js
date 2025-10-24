import React, { useState } from "react";
import { sendQuery } from "../api";

export default function Chatbot({ setNavigationTarget }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");

    const handleSend = async () => {
        if (!input) return;
        setMessages([...messages, { sender: "user", text: input }]);

        const res = await sendQuery(input); // { intent, entity }

        setMessages(prev => [...prev, { sender: "bot", text: `Intent: ${res.intent}, Entity: ${res.entity}` }]);

        if (res.intent === "navigate") {
            setNavigationTarget(res.entity); // show Navigate button
        }

        setInput("");
    };

    return (
        <div style={{ padding: 20 }}>
            <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid gray", padding: 10 }}>
                {messages.map((m, i) => (
                    <div key={i} style={{ textAlign: m.sender === "user" ? "right" : "left" }}>
                        <b>{m.sender}:</b> {m.text}
                    </div>
                ))}
            </div>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask something..." />
            <button onClick={handleSend}>Send</button>
        </div>
    );
}
