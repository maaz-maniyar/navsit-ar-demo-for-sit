import React, { useEffect } from "react";
import "aframe";

const ARView = ({ path }) => {
    useEffect(() => {
        const sceneEl = document.querySelector("a-scene");
        if (!sceneEl || !path?.nodes) return;

        // Remove existing arrows
        sceneEl.querySelectorAll(".arrow").forEach((el) => el.remove());

        path.edges.forEach(([start, end]) => {
            const s = path.nodes[start];
            const e = path.nodes[end];
            if (!s || !e) return;

            const midX = (s[0] + e[0]) / 2;
            const midZ = (s[1] + e[1]) / 2;
            const angle = Math.atan2(e[1] - s[1], e[0] - s[0]) * (180 / Math.PI);

            const arrow = document.createElement("a-entity");
            arrow.setAttribute(
                "geometry",
                "primitive: cone; radiusBottom: 0.2; radiusTop: 0.0; height: 0.6"
            );
            arrow.setAttribute("material", "color: red");
            arrow.setAttribute("position", `${midX} 0 ${midZ}`);
            arrow.setAttribute("rotation", `0 ${-angle} 0`);
            arrow.classList.add("arrow");

            sceneEl.appendChild(arrow);
        });
    }, [path]);

    return (
        <>
            {/* Load AR.js from CDN */}
            <script src="https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@master/aframe/build/aframe-ar.js"></script>

            <a-scene
                vr-mode-ui="enabled: false"
                embedded
                arjs="sourceType: webcam; debugUIEnabled: false;"
                style={{ width: "100%", height: "100vh" }}
            >
                <a-entity camera></a-entity>
            </a-scene>
        </>
    );
};

export default ARView;
