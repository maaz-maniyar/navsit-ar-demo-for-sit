import React, { useState } from "react";

function Chatbot({ setShowAR, setPath }) {
    const [message, setMessage] = useState("");
    const [botReply, setBotReply] = useState("");

    const handleSend = async () => {
        const destination = message.trim();
        setMessage("");

        // Load the mockPath.json
        const data = await fetch("/mockPath.json").then(res => res.json());

        const nodes = data.nodes;
        const edges = data.edges;

        const startNode = nodes.find(n => n.name === "SIT Front Gate"); // start from front gate
        const endNode = nodes.find(n => n.name.toLowerCase() === destination.toLowerCase());

        if (!endNode) {
            setBotReply("Location not found in mockPath.json");
            return;
        }

        // BFS to find path
        const adjList = {};
        edges.forEach(e => {
            if (!adjList[e.from]) adjList[e.from] = [];
            adjList[e.from].push({ to: e.to, path: e.path });
        });

        const queue = [{ node: startNode.id, pathSoFar: [] }];
        const visited = new Set();
        let finalPath = null;

        while (queue.length) {
            const { node, pathSoFar } = queue.shift();
            if (node === endNode.id) {
                finalPath = pathSoFar;
                break;
            }
            if (visited.has(node)) continue;
            visited.add(node);
            if (adjList[node]) {
                adjList[node].forEach(neigh => {
                    queue.push({ node: neigh.to, pathSoFar: [...pathSoFar, ...neigh.path] });
                });
            }
        }

        if (!finalPath) {
            setBotReply("No path found to the destination.");
            return;
        }

        setBotReply(`Navigating to ${endNode.name}...`);
        setPath(finalPath);
        setShowAR(true);
    };

    return (
        <div style={{ padding: "1rem" }}>
            <h3>Chatbot</h3>
            <input
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type destination (e.g., ECE Block)"
            />
            <button onClick={handleSend}>Send</button>
            <p>{botReply}</p>
        </div>
    );
}

export default Chatbot;
