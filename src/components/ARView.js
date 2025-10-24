import React, { useEffect } from "react";
import "aframe";
import "ar.js";

const ARView = ({ pathData }) => {
    useEffect(() => {
        if (!pathData) return;

        const sceneEl = document.querySelector("a-scene");

        // Clear previous arrows if any
        const oldArrows = sceneEl.querySelectorAll(".arrow");
        oldArrows.forEach((el) => el.parentNode.removeChild(el));

        // Loop through path nodes to add arrows
        for (let i = 0; i < pathData.edges.length; i++) {
            const [startNode, endNode] = pathData.edges[i];
            const startCoords = pathData.nodes[startNode];
            const endCoords = pathData.nodes[endNode];

            if (!startCoords || !endCoords) continue;

            const arrow = document.createElement("a-box");
            arrow.setAttribute("position", {
                x: (startCoords[0] + endCoords[0]) / 2,
                y: 1, // height above ground
                z: (startCoords[1] + endCoords[1]) / 2,
            });
            arrow.setAttribute("rotation", "0 0 0");
            arrow.setAttribute("scale", "0.2 0.2 0.8");
            arrow.setAttribute("color", "#ff0000");
            arrow.classList.add("arrow");

            sceneEl.appendChild(arrow);
        }
    }, [pathData]);

    return (
        <a-scene
            embedded
            vr-mode-ui="enabled: false"
            arjs="sourceType: webcam; debugUIEnabled: false;"
            style={{ width: "100%", height: "100vh" }}
        >
            <a-entity camera></a-entity>
        </a-scene>
    );
};

export default ARView;
