import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BASE_URL } from "../config";

function ARView({ arrowStyle, path }) {
    const mountRef = useRef();
    const videoRef = useRef();
    const arrowGroupRef = useRef();
    const [userCoords, setUserCoords] = useState(null);
    const [targetCoords, setTargetCoords] = useState({ lat: 13.331748, lng: 77.127378 });
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [cameraStopped, setCameraStopped] = useState(false);

    // 🔹 Utility: distance between two lat/lngs
    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // 🔹 Smooth GPS updates (average last 5)
    useEffect(() => {
        let lastPositions = [];
        const MAX_POINTS = 5;

        const geoWatch = navigator.geolocation.watchPosition(
            (pos) => {
                const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                lastPositions.push(newPos);
                if (lastPositions.length > MAX_POINTS) lastPositions.shift();

                const avgLat =
                    lastPositions.reduce((a, p) => a + p.lat, 0) / lastPositions.length;
                const avgLng =
                    lastPositions.reduce((a, p) => a + p.lng, 0) / lastPositions.length;

                setUserCoords({ lat: avgLat, lng: avgLng });
            },
            (err) => console.error(err),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );

        return () => navigator.geolocation.clearWatch(geoWatch);
    }, []);

    // 🔹 Fetch dynamic next node every 5 seconds
    useEffect(() => {
        let interval;
        const fetchTarget = async () => {
            try {
                if (!userCoords) return;
                const res = await fetch(`${BASE_URL}/chat/update-node`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        latitude: userCoords.lat,
                        longitude: userCoords.lng,
                    }),
                });
                const data = await res.json();

                if (data.nextCoordinates && Array.isArray(data.nextCoordinates)) {
                    setTargetCoords({
                        lat: data.nextCoordinates[0],
                        lng: data.nextCoordinates[1],
                    });
                } else if (data.nextNode && typeof data.nextNode === "string") {
                    const nodesRes = await fetch(`${BASE_URL.replace("/api", "")}/api/nodes`);
                    if (nodesRes.ok) {
                        const nodes = await nodesRes.json();
                        if (nodes[data.nextNode]) {
                            setTargetCoords({
                                lat: nodes[data.nextNode][0],
                                lng: nodes[data.nextNode][1],
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching target node:", err);
            }
        };
        interval = setInterval(fetchTarget, 5000);
        fetchTarget();
        return () => clearInterval(interval);
    }, [userCoords]);

    // 🔹 Send chat message
    const sendMessage = async () => {
        if (!chatInput.trim()) return;
        try {
            const payload = { message: chatInput };
            if (userCoords) {
                payload.latitude = userCoords.lat;
                payload.longitude = userCoords.lng;
            }
            const res = await fetch(`${BASE_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            setChatHistory((prev) => [...prev, { user: chatInput, bot: data.reply || "..." }]);
            setChatInput("");
        } catch (err) {
            console.error("Error sending message:", err);
        }
    };

    // ---------------------------
    // AR LOGIC (stabilized)
    // ---------------------------
    useEffect(() => {
        let renderer, scene, camera, video, videoTexture;
        let movementHeading = null;
        let lastUserCoords = null;
        let deviceHeading = 0;

        const width = window.innerWidth;
        const height = window.innerHeight;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        mountRef.current?.appendChild(renderer.domElement);

        // 📷 Camera setup
        video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("playsinline", "");
        video.style.display = "none";
        videoRef.current = video;

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" }, audio: false })
            .then((stream) => {
                if (cameraStopped) return;
                video.srcObject = stream;
                video.play();
                videoTexture = new THREE.VideoTexture(video);
                videoTexture.minFilter = THREE.LinearFilter;
                videoTexture.magFilter = THREE.LinearFilter;
                videoTexture.format = THREE.RGBFormat;
                videoTexture.colorSpace = THREE.SRGBColorSpace;
                scene.background = videoTexture;
            })
            .catch((err) => console.error("Error accessing camera: ", err));

        // 🔺 Arrow setup
        const arrowGroup = new THREE.Group();
        arrowGroup.position.set(0, -0.5, -1);
        arrowGroupRef.current = arrowGroup;

        const cylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.25, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        cylinder.rotation.x = -Math.PI / 2;
        arrowGroup.add(cylinder);

        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.2, 16),
            new THREE.MeshStandardMaterial({ color: 0xff4757 })
        );
        cone.position.set(0, 0, -0.225);
        cone.rotation.x = -Math.PI / 2;
        arrowGroup.add(cone);

        camera.add(arrowGroup);
        scene.add(camera);

        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 10, 10);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        // Bearing computation
        const computeBearing = (lat1, lng1, lat2, lng2) => {
            const φ1 = THREE.MathUtils.degToRad(lat1);
            const φ2 = THREE.MathUtils.degToRad(lat2);
            const λ1 = THREE.MathUtils.degToRad(lng1);
            const λ2 = THREE.MathUtils.degToRad(lng2);
            const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
            const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
            let θ = Math.atan2(y, x);
            if (θ < 0) θ += 2 * Math.PI;
            return θ;
        };

        // Movement-based heading fusion
        const computeMovementHeading = (oldPos, newPos) => {
            const φ1 = THREE.MathUtils.degToRad(oldPos.lat);
            const φ2 = THREE.MathUtils.degToRad(newPos.lat);
            const Δλ = THREE.MathUtils.degToRad(newPos.lng - oldPos.lng);
            const y = Math.sin(Δλ) * Math.cos(φ2);
            const x =
                Math.cos(φ1) * Math.sin(φ2) -
                Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
            return Math.atan2(y, x);
        };

        const handleOrientation = (event) => {
            let heading;
            if (typeof event.webkitCompassHeading !== "undefined") {
                heading = THREE.MathUtils.degToRad(event.webkitCompassHeading);
            } else {
                const alpha = THREE.MathUtils.degToRad(event.alpha || 0);
                const beta = THREE.MathUtils.degToRad(event.beta || 0);
                const gamma = THREE.MathUtils.degToRad(event.gamma || 0);
                const cA = Math.cos(alpha),
                    sA = Math.sin(alpha);
                const cB = Math.cos(beta),
                    sB = Math.sin(beta);
                const cG = Math.cos(gamma),
                    sG = Math.sin(gamma);
                const Vx = -cA * sG - sA * sB * cG;
                const Vy = -sA * sG + cA * sB * cG;
                heading = Math.atan(Vx / Vy);
                if (Vy < 0) heading += Math.PI;
                else if (Vx < 0) heading += 2 * Math.PI;
            }
            deviceHeading = heading;
        };

        if (typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission().then((res) => {
                if (res === "granted") window.addEventListener("deviceorientation", handleOrientation, true);
            });
        } else {
            window.addEventListener("deviceorientation", handleOrientation, true);
        }

        // Main animation
        const animate = () => {
            setTimeout(() => requestAnimationFrame(animate), 33); // ~30fps
            if (!video.readyState >= video.HAVE_CURRENT_DATA) return;
            if (userCoords && targetCoords && arrowGroupRef.current) {
                // Compute movement heading
                if (lastUserCoords) {
                    const distMoved = getDistance(
                        lastUserCoords.lat,
                        lastUserCoords.lng,
                        userCoords.lat,
                        userCoords.lng
                    );
                    if (distMoved > 1) {
                        movementHeading = computeMovementHeading(lastUserCoords, userCoords);
                        lastUserCoords = userCoords;
                    }
                } else {
                    lastUserCoords = userCoords;
                }

                const bearing = computeBearing(
                    userCoords.lat,
                    userCoords.lng,
                    targetCoords.lat,
                    targetCoords.lng
                );

                const blendedHeading = movementHeading
                    ? deviceHeading * 0.7 + movementHeading * 0.3
                    : deviceHeading;

                const dist = getDistance(
                    userCoords.lat,
                    userCoords.lng,
                    targetCoords.lat,
                    targetCoords.lng
                );

                // Snap near node
                const smoothFactor = dist < 8 ? 0.1 : 0.3;
                arrowGroupRef.current.rotation.y = THREE.MathUtils.lerp(
                    arrowGroupRef.current.rotation.y,
                    bearing - blendedHeading,
                    smoothFactor
                );

                // Stop camera when very close
                if (dist < 10 && !cameraStopped && video.srcObject) {
                    video.srcObject.getTracks().forEach((t) => t.stop());
                    video.srcObject = null;
                    setCameraStopped(true);
                    console.log("📷 Camera stopped: Destination reached!");
                }
            }
            if (videoTexture) videoTexture.needsUpdate = true;
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (mountRef.current && renderer) mountRef.current.removeChild(renderer.domElement);
            if (video && video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
            window.removeEventListener("deviceorientation", handleOrientation);
        };
    }, [arrowStyle, userCoords, targetCoords, cameraStopped]);

    return (
        <>
            <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
            {cameraStopped && (
                <div
                    style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(0,0,0,0.6)",
                        color: "white",
                        padding: "12px 20px",
                        borderRadius: "8px",
                        fontWeight: "bold",
                    }}
                >
                    🎯 You’ve reached the SIT Front Gate
                </div>
            )}
            {/* Chat UI */}
            <div
                style={{
                    position: "absolute",
                    bottom: 30,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(255, 255, 255, 0.15)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: "16px",
                    padding: "12px",
                    width: "90%",
                    maxWidth: 420,
                    color: "#fff",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
            >
                <div
                    style={{
                        maxHeight: 150,
                        overflowY: "auto",
                        marginBottom: 10,
                        padding: "4px 8px",
                    }}
                >
                    {chatHistory.map((c, i) => (
                        <div key={i} style={{ marginBottom: 6 }}>
                            <div style={{ color: "#ffeaa7" }}>🧍‍♂️ {c.user}</div>
                            <div style={{ color: "#74b9ff" }}>🤖 {c.bot}</div>
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask or send a command..."
                        style={{
                            flex: 1,
                            padding: "10px 12px",
                            borderRadius: "10px",
                            border: "1px solid rgba(255,255,255,0.3)",
                            background: "rgba(255,255,255,0.2)",
                            color: "#fff",
                            outline: "none",
                        }}
                    />
                    <button
                        onClick={sendMessage}
                        style={{
                            background: "linear-gradient(135deg, #00b894, #00cec9)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "10px",
                            padding: "10px 14px",
                            fontWeight: "bold",
                            cursor: "pointer",
                            boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
                            transition: "0.3s",
                        }}
                        onMouseOver={(e) => (e.target.style.opacity = 0.9)}
                        onMouseOut={(e) => (e.target.style.opacity = 1)}
                    >
                        Send
                    </button>
                </div>
            </div>
        </>
    );
}

export default ARView;
