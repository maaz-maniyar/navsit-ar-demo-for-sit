// src/components/ARView.js
import React, { useEffect, useRef, useState } from "react";
import { BASE_URL } from "../config";
import * as THREE from "three";

const ARView = ({ path }) => {
    const [nextNode, setNextNode] = useState(null);
    const [nodeCoords, setNodeCoords] = useState(null);
    const [userCoords, setUserCoords] = useState(null);
    const containerRef = useRef(null);
    const arrowRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);

    // === 1️⃣ Get live GPS ===
    useEffect(() => {
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setUserCoords({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                });
            },
            (err) => console.error("GPS Error:", err),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // === 2️⃣ Fetch node coordinates from backend path ===
    useEffect(() => {
        if (!path || !path.length) return;
        const fetchNodeData = async () => {
            try {
                const res = await fetch(`${BASE_URL}/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: "continue" }),
                });
                const data = await res.json();
                if (data.coordinates && data.path && data.path.length > 1) {
                    const coords = data.coordinates[data.path[1]];
                    setNextNode(data.path[1]);
                    setNodeCoords({ lat: coords[0], lon: coords[1] });
                }
            } catch (err) {
                console.error("Error fetching node data:", err);
            }
        };
        fetchNodeData();
    }, [path]);

    // === 3️⃣ Setup WebXR AR Scene ===
    useEffect(() => {
        if (!containerRef.current) return;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera();
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Light
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        scene.add(light);

        // Arrow (simple cone)
        const arrowGeometry = new THREE.ConeGeometry(0.1, 0.3, 32);
        const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.rotation.x = Math.PI; // point forward
        scene.add(arrow);
        arrowRef.current = arrow;

        // Start WebXR AR Session
        navigator.xr
            ?.requestSession("immersive-ar", { requiredFeatures: ["local-floor", "camera-access"] })
            .then((session) => {
                renderer.xr.setSession(session);
                const animate = () => {
                    renderer.setAnimationLoop(() => {
                        renderer.render(scene, camera);
                    });
                };
                animate();
            })
            .catch((err) => console.error("WebXR init failed:", err));

        return () => {
            renderer.setAnimationLoop(null);
            renderer.dispose();
            containerRef.current.removeChild(renderer.domElement);
        };
    }, []);

    // === 4️⃣ Update Arrow Rotation towards next node ===
    useEffect(() => {
        if (!nodeCoords || !userCoords || !arrowRef.current) return;

        const toRadians = (deg) => (deg * Math.PI) / 180;
        const toDegrees = (rad) => (rad * 180) / Math.PI;

        const lat1 = toRadians(userCoords.lat);
        const lon1 = toRadians(userCoords.lon);
        const lat2 = toRadians(nodeCoords.lat);
        const lon2 = toRadians(nodeCoords.lon);

        const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
        const x =
            Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        const bearing = (toDegrees(Math.atan2(y, x)) + 360) % 360;

        const rotateArrow = (heading) => {
            const relativeBearing = bearing - heading;
            arrowRef.current.rotation.y = THREE.MathUtils.degToRad(relativeBearing);
        };

        const handleOrientation = (event) => {
            const heading = event.webkitCompassHeading || 360 - event.alpha;
            if (heading != null) rotateArrow(heading);
        };

        window.addEventListener("deviceorientationabsolute", handleOrientation, true);
        return () => window.removeEventListener("deviceorientationabsolute", handleOrientation);
    }, [nodeCoords, userCoords]);

    // === 5️⃣ Poll backend every 5s to check next node ===
    useEffect(() => {
        const interval = setInterval(async () => {
            if (!userCoords) return;
            try {
                const res = await fetch(`${BASE_URL}/chat/update-node`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        latitude: userCoords.lat,
                        longitude: userCoords.lon,
                    }),
                });
                const data = await res.json();
                if (data.nextNode && data.coordinates) {
                    setNextNode(data.nextNode);
                    setNodeCoords({
                        lat: data.coordinates[0],
                        lon: data.coordinates[1],
                    });
                }
            } catch (err) {
                console.error("Update node error:", err);
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [userCoords]);

    return (
        <div
            ref={containerRef}
            style={{
                height: "100vh",
                width: "100vw",
                overflow: "hidden",
                backgroundColor: "black",
            }}
        />
    );
};

export default ARView;
