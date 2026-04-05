import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BACKEND_ORIGIN } from "../config";

const DEFAULT_OFFSET = -7;
const DEBUG_UPDATE_MS = 200;

const ARView = ({ onBack }) => {
    const containerRef = useRef(null);
    const arrowGroupRef = useRef(null);

    const bearingOffsetRef = useRef(DEFAULT_OFFSET);

    const [debug, setDebug] = useState({
        heading: 0,
        bearing: 0,
        relative: 0,
        nextNode: "",
        offset: DEFAULT_OFFSET,
    });

    // Load saved offset
    useEffect(() => {
        const saved = localStorage.getItem("arrowOffset");
        if (saved) {
            bearingOffsetRef.current = parseFloat(saved);
            setDebug((d) => ({ ...d, offset: parseFloat(saved) }));
        }
    }, []);

    useEffect(() => {
        let scene, camera, renderer, watchId;
        const loader = new GLTFLoader();
        let animationFrameId;
        let lastDebugUpdate = 0;

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
        const getScreenAngle = () => {
            if (window.screen?.orientation && typeof window.screen.orientation.angle === "number") {
                return window.screen.orientation.angle;
            }
            if (typeof window.orientation === "number") {
                return window.orientation;
            }
            return 0;
        };
        const normalizeDegrees = (value) => ((value % 360) + 360) % 360;
        const shortestAngleDelta = (fromDeg, toDeg) => {
            return ((toDeg - fromDeg + 540) % 360) - 180;
        };
        const getHeading = (event) => {
            if (typeof event.webkitCompassHeading === "number") {
                return normalizeDegrees(event.webkitCompassHeading);
            }

            if (!event.absolute || event.alpha === null) {
                return null;
            }

            const screenAngle = getScreenAngle();
            return normalizeDegrees(360 - event.alpha + screenAngle);
        };

        // === Live Data ===
        let deviceHeading = null;
        let targetBearing = 0;
        let targetCoords = null;
        let lastUpdateTime = 0;
        let orientationHandler;

        // === Orientation ===
        orientationHandler = (event) => {
            const heading = getHeading(event);
            if (heading !== null) {
                deviceHeading = heading;
            }
        };
        window.addEventListener("deviceorientation", orientationHandler, true);

        // === Backend Updates ===
        async function fetchNextNode(lat, lon) {
            try {
                const res = await fetch(`${BACKEND_ORIGIN}/api/chat/update-node`, {
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
            animationFrameId = requestAnimationFrame(animate);

            if (arrowGroupRef.current && deviceHeading !== null) {
                const offset = bearingOffsetRef.current;
                const relative = normalizeDegrees(targetBearing - deviceHeading + offset);
                const currentY = THREE.MathUtils.radToDeg(arrowGroupRef.current.rotation.y);
                const delta = shortestAngleDelta(currentY, relative);
                arrowGroupRef.current.rotation.y = THREE.MathUtils.degToRad(currentY + delta * 0.15);

                const now = Date.now();
                if (now - lastDebugUpdate >= DEBUG_UPDATE_MS) {
                    lastDebugUpdate = now;
                    setDebug((d) => ({
                        ...d,
                        heading: deviceHeading.toFixed(1),
                        bearing: targetBearing.toFixed(1),
                        relative: relative.toFixed(1),
                        offset: offset.toFixed(1),
                    }));
                }
            }

            renderer.render(scene, camera);
        };
        animate();

        // === Cleanup ===
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (watchId) navigator.geolocation.clearWatch(watchId);
            if (orientationHandler) {
                window.removeEventListener("deviceorientation", orientationHandler, true);
            }
            if (renderer) renderer.dispose();
            document.querySelectorAll("video").forEach((v) => v.remove());
        };
    }, []);

    // === Slider Handler ===
    const handleOffsetChange = (value) => {
        bearingOffsetRef.current = value;
        localStorage.setItem("arrowOffset", value);
        setDebug((d) => ({ ...d, offset: value }));
    };

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
                Return to Chat
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
                <div>Offset: {debug.offset}°</div>
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
                <label>Adjust Arrow Offset ({debug.offset}°)</label>
                <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={debug.offset}
                    onChange={(e) => handleOffsetChange(parseFloat(e.target.value))}
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
