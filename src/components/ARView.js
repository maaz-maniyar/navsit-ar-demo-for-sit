import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

function ARView({ onBack }) {
    const containerRef = useRef();
    const arrowRef = useRef();
    const currentPosRef = useRef(null);
    const targetCoords = { lat: 13.331624095990712, lon: 77.12728232145311 };

    useEffect(() => {
        // --- Scene setup ---
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            1000
        );
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);

        // --- Light ---
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
        scene.add(hemiLight);

        // --- Ground plane ---
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshStandardMaterial({
                color: 0x222222,
                transparent: true,
                opacity: 0.2,
            })
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // --- Load GLB Arrow ---
        const loader = new GLTFLoader();
        loader.load(
            "/models/RedArrow.glb",
            (gltf) => {
                const arrow = gltf.scene;
                arrow.scale.set(0.3, 0.3, 0.3); // smaller arrow
                arrow.position.set(0, 0, 0); // center on ground
                scene.add(arrow);
                arrowRef.current = arrow;
            },
            undefined,
            (err) => console.error("Error loading arrow model:", err)
        );

        // --- Camera setup ---
        camera.position.set(0, 1.5, 3);

        // --- Render loop ---
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (containerRef.current && renderer.domElement) {
                containerRef.current.removeChild(renderer.domElement);
            }
        };
    }, []);

    useEffect(() => {
        // Request location
        navigator.geolocation.watchPosition(
            (pos) => {
                currentPosRef.current = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                };
            },
            (err) => console.warn("GPS Error:", err),
            { enableHighAccuracy: true }
        );

        // Ask for orientation permissions (iOS needs this)
        const requestPermission = async () => {
            if (
                typeof DeviceOrientationEvent !== "undefined" &&
                typeof DeviceOrientationEvent.requestPermission === "function"
            ) {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission !== "granted") {
                    alert("Please allow compass permission for navigation to work.");
                }
            }
        };
        requestPermission();

        window.addEventListener("deviceorientationabsolute", handleOrientation, true);

        function handleOrientation(event) {
            if (!arrowRef.current || !currentPosRef.current) return;
            if (event.alpha == null) return;

            const deviceHeading = 360 - event.alpha; // Convert to compass heading
            const bearing = computeBearing(currentPosRef.current, targetCoords);
            const relativeAngle = THREE.MathUtils.degToRad(bearing - deviceHeading);
            arrowRef.current.rotation.y = relativeAngle;
        }

        function computeBearing(pos1, pos2) {
            const lat1 = THREE.MathUtils.degToRad(pos1.lat);
            const lon1 = THREE.MathUtils.degToRad(pos1.lon);
            const lat2 = THREE.MathUtils.degToRad(pos2.lat);
            const lon2 = THREE.MathUtils.degToRad(pos2.lon);

            const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
            const x =
                Math.cos(lat1) * Math.sin(lat2) -
                Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
            let brng = (Math.atan2(y, x) * 180) / Math.PI;
            return (brng + 360) % 360;
        }

        return () => {
            window.removeEventListener("deviceorientationabsolute", handleOrientation);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{
                width: "100vw",
                height: "100vh",
                background: "black",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <button
                onClick={onBack}
                style={{
                    position: "absolute",
                    top: "20px",
                    left: "20px",
                    padding: "10px 16px",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    zIndex: 5,
                }}
            >
                ← Back
            </button>
        </div>
    );
}

export default ARView;
