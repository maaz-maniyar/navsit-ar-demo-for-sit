import React, { useEffect } from "react";
import { getPath } from "../api";

export default function ARView({ target }) {
    useEffect(() => {
        const startAR = async () => {
            // TODO: get user's current location
            const userLocation = [13.321, 77.123]; // example, integrate GPS
            const path = await getPath("MainGate", target); // replace MainGate with actual current node

            // Render path with A-Frame entities
            // Example:
            const scene = document.querySelector("a-scene");
            path.forEach((coord, i) => {
                const arrow = document.createElement("a-entity");
                arrow.setAttribute("geometry", "primitive: cone; height: 0.5; radiusBottom: 0.2;");
                arrow.setAttribute("material", "color: red;");
                arrow.setAttribute("position", { x: coord[0], y: 0, z: coord[1] });
                scene.appendChild(arrow);
            });
        };

        startAR();
    }, [target]);

    return (
        <a-scene embedded arjs='sourceType: webcam;'>
            <a-camera></a-camera>
        </a-scene>
    );
}
