import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const BACKEND_URL = "https://navsit-backend-production.up.railway.app";

const ARView = ({ onBack }) => {
    const containerRef = useRef(null);
    const arrowGroupRef = useRef(null);

    const [debug, setDebug] = useState({
        heading: 0,
        bearing: 0,
        relative: 0,
        nextNode: "",
    });

    const [bearingOffset, setBearingOffset] = useState(() => {
        const saved = localStorage.getItem("arrowOffset");
        return saved ? parseFloat(saved) : -90;
    });

    useEffect(() => {
        let scene, camera, renderer, watchId;
        const loader = new GLTFLoader();

        // === Scene Setup ===
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, 1.6, 0);

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);

        // === Lighting ===
        scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        const dirLight = new THREE.DirectionalLight(0xffffff, 2);
        dirLight.position.set(0, 5, 5);
        scene.add(dirLight);

        // === Arrow Group ===
        const arrowGroup = new THREE.Group();
        arrowGroup.position.set(0, 0, -3);
        scene.add(arrowGroup);
        arrowGroupRef.current = arrowGroup;

        // === Load Arrow Model ===
        loader.load(
            "/RedArrow.glb",
            (gltf) => {
                const arrow = gltf.scene;
                arrow.scale.set(0.4, 0.4, 0.4);
                arrow.rotation.x = -Math.PI / 4;
                arrow.position.set(0, -0.5, 0);
                arrowGroup.add(arrow);
                console.log("✅ Arrow loaded");
            },
            undefined,
            (err) => console.error("❌ Error loading arrow:", err)
        );

        // === Camera Feed ===
        const video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("playsinline", "");
        Object.assign(video.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            objectFit: "cover",
            zIndex: "-1",
        });
        document.body.appendChild(video);

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then((stream) => (video.srcObject = stream))
            .catch((err) => console.error("Camera error:", err));

        // === Helpers ===
        const toRad = (deg) => (deg * Math.PI) / 180;
        const calculateBearing = (lat1, lon1, lat2, lon2) => {
            const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
            const x =
                Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                Math.sin(toRad(lat1)) *
                Math.cos(toRad(lat2)) *
                Math.cos(toRad(lon2 - lon1));
            const brng = Math.atan2(y, x);
            return ((brng * 180) / Math.PI + 360) % 360;
        };

        // === Live Data ===
        let deviceHeading = 0;
        let targetBearing = 0;
        let targetCoords = null;
        let lastUpdateTime = 0;

        // === Orientation ===
        window.addEventListener("deviceorientation", (event) => {
            if (event.webkitCompassHeading !== undefined) {
                deviceHeading = event.webkitCompassHeading; // iOS
            } else if (event.alpha !== null) {
                deviceHeading = 360 - event.alpha; // Android
            }
        });

        // === Backend Updates ===
        async function fetchNextNode(lat, lon) {
            try {
                const res = await fetch(`${BACKEND_URL}/api/chat/update-node`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ latitude: lat, longitude: lon }),
                });
                const data = await res.json();
                if (data?.nextCoordinates) {
                    targetCoords = {
                        lat: data.nextCoordinates[0],
                        lon: data.nextCoordinates[1],
                    };
                    setDebug((d) => ({ ...d, nextNode: data.nextNode || "Unknown" }));
                }
            } catch (err) {
                console.error("❌ Update-node error:", err);
            }
        }

        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const now = Date.now();
                    if (now - lastUpdateTime > 5000) {
                        lastUpdateTime = now;
                        fetchNextNode(latitude, longitude);
                    }

                    if (targetCoords) {
                        targetBearing = calculateBearing(
                            latitude,
                            longitude,
                            targetCoords.lat,
                            targetCoords.lon
                        );
                    }
                },
                (err) => console.error("GPS error:", err),
                { enableHighAccuracy: true }
            );
        }

        // === Animation Loop ===
        const animate = () => {
            requestAnimationFrame(animate);

            if (arrowGroupRef.current) {
                const relative = (targetBearing - deviceHeading + bearingOffset + 360) % 360;
                const targetY = THREE.MathUtils.degToRad(relative);
                arrowGroupRef.current.rotation.y +=
                    (targetY - arrowGroupRef.current.rotation.y) * 0.15;

                setDebug((d) => ({
                    ...d,
                    heading: deviceHeading.toFixed(1),
                    bearing: targetBearing.toFixed(1),
                    relative: relative.toFixed(1),
                }));
            }

            renderer.render(scene, camera);
        };
        animate();

        // === Cleanup ===
        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
            if (renderer) renderer.dispose();
            document.querySelectorAll("video").forEach((v) => v.remove());
        };
    }, []); // ⚠️ No bearingOffset dependency — scene only initializes once

    // Persist offset changes
    useEffect(() => {
        localStorage.setItem("arrowOffset", bearingOffset);
    }, [bearingOffset]);

    return (
        <>
            <div
                ref={containerRef}
                style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
            />
            <button
                onClick={onBack}
                style={{
                    position: "absolute",
                    top: 20,
                    left: 20,
                    zIndex: 10,
                    background: "rgba(0,0,0,0.5)",
                    color: "white",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                }}
            >
                Back
            </button>

            {/* Debug Info */}
            <div
                style={{
                    position: "absolute",
                    bottom: 90,
                    left: 20,
                    zIndex: 10,
                    background: "rgba(0,0,0,0.5)",
                    color: "#0f0",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontFamily: "monospace",
                    fontSize: "14px",
                }}
            >
                <div>Heading: {debug.heading}°</div>
                <div>Bearing: {debug.bearing}°</div>
                <div>Relative: {debug.relative}°</div>
                <div>Next: {debug.nextNode}</div>
                <div>Offset: {bearingOffset}°</div>
            </div>

            {/* Offset Slider */}
            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "80%",
                    zIndex: 10,
                    textAlign: "center",
                    color: "white",
                }}
            >
                <label>Adjust Arrow Offset ({bearingOffset}°)</label>
                <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={bearingOffset}
                    onChange={(e) => setBearingOffset(parseFloat(e.target.value))}
                    style={{
                        width: "100%",
                        marginTop: "8px",
                        accentColor: "#4CAF50",
                    }}
                />
            </div>
        </>
    );
};

export default ARView;
