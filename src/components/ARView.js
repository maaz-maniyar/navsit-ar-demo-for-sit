import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const ARView = ({ nextNodeCoords, onBack }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!nextNodeCoords) return;

        const container = containerRef.current;
        if (!container) return;

        // === Setup ===
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 10, 10);
        scene.add(light);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // === Load the Arrow ===
        const loader = new GLTFLoader();
        let arrow;
        loader.load(
            process.env.PUBLIC_URL + "/models/RedArrow.glb",
            (gltf) => {
                arrow = gltf.scene;
                arrow.scale.set(1.5, 1.5, 1.5);
                scene.add(arrow);
            },
            undefined,
            (error) => console.error("Error loading RedArrow.glb:", error)
        );

        camera.position.set(0, 1.5, 3);

        // === Animation Loop ===
        const animate = () => {
            requestAnimationFrame(animate);

            if (arrow && nextNodeCoords) {
                // Simulate arrow facing the direction of the next node
                // (for real AR, replace with compass-based orientation)
                const dx = nextNodeCoords.lon - 77.127378;
                const dz = nextNodeCoords.lat - 13.331748;
                const targetAngle = Math.atan2(dx, dz);
                arrow.rotation.y = targetAngle;
            }

            renderer.render(scene, camera);
        };
        animate();

        // === Handle window resize ===
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);

        // === Cleanup ===
        return () => {
            window.removeEventListener("resize", handleResize);

            if (renderer) {
                renderer.dispose();
            }

            if (container && renderer.domElement && container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }

            scene.clear();
        };
    }, [nextNodeCoords]);

    return (
        <div
            ref={containerRef}
            style={{
                width: "100vw",
                height: "100vh",
                overflow: "hidden",
                position: "relative",
            }}
        >
            <button
                onClick={onBack}
                style={{
                    position: "absolute",
                    top: 20,
                    left: 20,
                    padding: "10px 20px",
                    background: "#ff4757",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "16px",
                }}
            >
                Back
            </button>
        </div>
    );
};

export default ARView;
