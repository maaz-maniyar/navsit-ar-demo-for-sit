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

    // --- New UI flags ---
    const [trackingHealthy, setTrackingHealthy] = useState(true); // for fallback compass
    const [distanceToTarget, setDistanceToTarget] = useState(null);

    // --- Constants / thresholds ---
    const SKIP_THRESHOLD = 10; // meters: skip nodes closer than this
    const TURN_ALERT_DIST = 12; // meters: vibrate for approaching turn
    const ARRIVAL_THRESHOLD = 8; // meters: arrival
    const SIGNIFICANT_BEARING_CHANGE = (10 * Math.PI) / 180; // 10 degrees in radians

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
            (err) => {
                console.error(err);
                setTrackingHealthy(false);
            },
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );

        return () => navigator.geolocation.clearWatch(geoWatch);
    }, []);

    // 🔹 Fetch dynamic next node every 5 seconds (with node-skipping logic)
    useEffect(() => {
        let interval;
        const fetchTarget = async () => {
            try {
                if (!userCoords) {
                    setTrackingHealthy(false);
                    return;
                }
                setTrackingHealthy(true);
                const res = await fetch(`${BASE_URL}/chat/update-node`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        latitude: userCoords.lat,
                        longitude: userCoords.lng,
                    }),
                });
                const data = await res.json();

                // Prefer numeric coordinates if present
                let candidateCoords = null;
                if (data.nextCoordinates && Array.isArray(data.nextCoordinates)) {
                    candidateCoords = { lat: data.nextCoordinates[0], lng: data.nextCoordinates[1] };
                } else if (data.nextNode && typeof data.nextNode === "string") {
                    // fetch coordinates by node name
                    const nodesRes = await fetch(`${BASE_URL.replace("/api", "")}/api/nodes`);
                    if (nodesRes.ok) {
                        const nodes = await nodesRes.json();
                        if (nodes[data.nextNode]) {
                            candidateCoords = { lat: nodes[data.nextNode][0], lng: nodes[data.nextNode][1] };
                        }
                    }
                }

                // If backend returns a remainingPath (preferred) use it to skip nodes
                // backend may return "remainingPath" or "path" (we handle both)
                const remainingPath = data.remainingPath || data.path || null;

                if (candidateCoords) {
                    const dist = getDistance(userCoords.lat, userCoords.lng, candidateCoords.lat, candidateCoords.lng);

                    // If candidate is too close, attempt to advance in remainingPath (skip)
                    if (dist < SKIP_THRESHOLD && Array.isArray(remainingPath) && remainingPath.length > 1) {
                        // try to pick the next meaningful node (index 1)
                        const nextName = remainingPath.length > 1 ? remainingPath[1] : remainingPath[0];
                        if (nextName) {
                            const nodesRes = await fetch(`${BASE_URL.replace("/api", "")}/api/nodes`);
                            if (nodesRes.ok) {
                                const nodes = await nodesRes.json();
                                if (nodes[nextName]) {
                                    setTargetCoords({ lat: nodes[nextName][0], lng: nodes[nextName][1] });
                                    return;
                                }
                            }
                        }
                    }

                    // Otherwise set the returned candidate
                    setTargetCoords(candidateCoords);
                } else {
                    // no coordinates returned — keep existing target but mark tracking not great
                    console.warn("No candidate coords from /update-node");
                }

            } catch (err) {
                console.error("Error fetching target node:", err);
                setTrackingHealthy(false);
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
    // AR LOGIC (stabilized + enhancements)
    // ---------------------------
    useEffect(() => {
        let renderer, scene, camera, video, videoTexture;
        let movementHeading = null;
        let lastUserCoords = null;
        let deviceHeading = 0;
        let lastBearing = null;
        let lastVibrationTurnAt = 0;
        let arrived = false;

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
            .catch((err) => {
                console.error("Error accessing camera: ", err);
                setTrackingHealthy(false);
            });

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

        // Distance label (we will render as HTML overlay; this keeps things simple & stable)
        const updateDistanceLabel = (d) => {
            setDistanceToTarget(Math.round(d));
        };

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
            }).catch(()=> {
                window.addEventListener("deviceorientation", handleOrientation, true);
            });
        } else {
            window.addEventListener("deviceorientation", handleOrientation, true);
        }

        // Helper: small safe vibrator wrapper
        const doVibrate = (pattern) => {
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                try {
                    navigator.vibrate(pattern);
                } catch (e) {
                    // ignore
                }
            }
        };

        // Main animation loop (use requestAnimationFrame for smoothness)
        let rafId;
        const animate = () => {
            rafId = requestAnimationFrame(animate);

            // basic tracking health: video + user coords
            const videoOk = video && video.readyState >= video.HAVE_CURRENT_DATA;
            if (!videoOk || !userCoords) {
                setTrackingHealthy(false);
            } else {
                setTrackingHealthy(true);
            }

            if (!videoOk) {
                // render a blank or minimal scene if camera not ready
                renderer.clear();
                return;
            }

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

                // update distance label state (rounded meters)
                updateDistanceLabel(dist);

                // If lastBearing exists, check for a significant change in intended direction
                if (lastBearing !== null) {
                    const bearingDiff = Math.abs(bearing - lastBearing);
                    // normalize > PI
                    const normDiff = bearingDiff > Math.PI ? 2 * Math.PI - bearingDiff : bearingDiff;

                    // If approaching a turn (distance within TURN_ALERT_DIST) and big change, vibrate
                    const now = Date.now();
                    if (normDiff > SIGNIFICANT_BEARING_CHANGE && dist < TURN_ALERT_DIST && (now - lastVibrationTurnAt) > 5000) {
                        // short vibration to alert upcoming turn
                        doVibrate([70]);
                        lastVibrationTurnAt = now;
                    }
                }

                // Snap near node: smoother near target
                const smoothFactor = dist < 8 ? 0.08 : 0.28;
                arrowGroupRef.current.rotation.y = THREE.MathUtils.lerp(
                    arrowGroupRef.current.rotation.y,
                    bearing - blendedHeading,
                    smoothFactor
                );

                // Arrival handling
                if (dist < ARRIVAL_THRESHOLD && !arrived) {
                    arrived = true;
                    // stop camera
                    if (video.srcObject) {
                        video.srcObject.getTracks().forEach((t) => t.stop());
                        video.srcObject = null;
                    }
                    setCameraStopped(true);
                    doVibrate([180]); // arrival haptic
                    console.log("📷 Camera stopped: Destination reached!");
                }

                lastBearing = bearing;
            }

            if (videoTexture) videoTexture.needsUpdate = true;
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(rafId);
            if (mountRef.current && renderer) mountRef.current.removeChild(renderer.domElement);
            if (video && video.srcObject) try { video.srcObject.getTracks().forEach((t) => t.stop()); } catch (e) {}
            window.removeEventListener("deviceorientation", handleOrientation);
        };
    }, [arrowStyle, userCoords, targetCoords, cameraStopped]);

    // Simple compass fallback UI (top-right compact)
    const CompassFallback = ({ headingDeg, distance }) => {
        // headingDeg: degrees where 0 = north
        const size = 72;
        return (
            <div style={{
                position: "absolute",
                top: 16,
                right: 16,
                width: size,
                height: size,
                borderRadius: size / 2,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                zIndex: 50,
                border: "1px solid rgba(255,255,255,0.12)"
            }}>
                <div style={{ textAlign: "center", fontSize: 11 }}>
                    <div style={{ transform: `rotate(${headingDeg}deg)`, transition: "transform 200ms linear" }}>
                        {/* simple needle using CSS */}
                        <svg width="36" height="36" viewBox="0 0 36 36" style={{ display: "block" }}>
                            <g transform="translate(18,18)">
                                <polygon points="0,-12 4,4 0,2 -4,4" fill="#ff4757" />
                                <circle r="2" fill="#ffffff" />
                            </g>
                        </svg>
                    </div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{distance ? `${distance} m` : "..."}</div>
                </div>
            </div>
        );
    };

    // compute heading degrees from deviceorientation if available (best-effort)
    const [headingDegState, setHeadingDegState] = useState(0);
    useEffect(() => {
        const updateHeadingDeg = (e) => {
            let deg = 0;
            if (typeof e.webkitCompassHeading !== "undefined") {
                deg = e.webkitCompassHeading;
            } else {
                // fallback to alpha
                deg = e.alpha || 0;
            }
            // alpha is 0..360. Convert to deg for display (invert so needle points correctly)
            setHeadingDegState(-deg);
        };

        if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission().then((res) => {
                if (res === "granted") window.addEventListener("deviceorientation", updateHeadingDeg, true);
            }).catch(() => {
                window.addEventListener("deviceorientation", updateHeadingDeg, true);
            });
        } else {
            window.addEventListener("deviceorientation", updateHeadingDeg, true);
        }

        return () => window.removeEventListener("deviceorientation", updateHeadingDeg);
    }, []);

    return (
        <>
            <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />

            {/* Distance label centered above bottom-ish (keeps UI uncluttered) */}
            <div style={{
                position: "absolute",
                bottom: 140,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.45)",
                padding: "6px 10px",
                borderRadius: 12,
                color: "#fff",
                fontWeight: "600",
                zIndex: 40,
                minWidth: 56,
                textAlign: "center",
                fontFamily: "Poppins, sans-serif",
                pointerEvents: "none"
            }}>
                {distanceToTarget !== null ? `${distanceToTarget} m` : "— m"}
            </div>

            {/* Fallback compass displayed when tracking unhealthy */}
            {!trackingHealthy && (
                <CompassFallback headingDeg={headingDegState} distance={distanceToTarget} />
            )}

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
                        zIndex: 40
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
                    zIndex: 30
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
                        onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
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
                        onMouseOver={(e) => (e.currentTarget.style.opacity = 0.9)}
                        onMouseOut={(e) => (e.currentTarget.style.opacity = 1)}
                    >
                        Send
                    </button>
                </div>
            </div>
        </>
    );
}

export default ARView;
