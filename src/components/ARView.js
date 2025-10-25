import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function ARView({ arrowStyle, backendUrl }) {
    const mountRef = useRef();
    const videoRef = useRef();
    const arrowGroupRef = useRef();
    const [userCoords, setUserCoords] = useState(null);
    const [targetCoords, setTargetCoords] = useState({ lat: 13.331748, lng: 77.127378 }); // default SIT Front Gate
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState([]);

    // Fetch the dynamic target from backend periodically
    useEffect(() => {
        const fetchTarget = async () => {
            try {
                const res = await fetch(`${backendUrl}/next-node`);
                const data = await res.json();
                if (data.lat && data.lng) {
                    setTargetCoords({ lat: data.lat, lng: data.lng });
                }
            } catch (err) {
                console.error("Error fetching target node:", err);
            }
        };
        fetchTarget();
        const interval = setInterval(fetchTarget, 5000); // refresh every 5s
        return () => clearInterval(interval);
    }, [backendUrl]);

    // Send chat message to backend
    const sendMessage = async () => {
        if (!chatInput) return;
        try {
            const res = await fetch(`${backendUrl}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: chatInput }),
            });
            const data = await res.json();
            setChatHistory((prev) => [...prev, { user: chatInput, bot: data.reply || "" }]);
            setChatInput("");
        } catch (err) {
            console.error("Error sending message:", err);
        }
    };

    // ----------------------
    // Original AR logic starts here (untouched)
    // ----------------------
    useEffect(() => {
        let renderer, scene, camera, video, videoTexture;
        const width = window.innerWidth;
        const height = window.innerHeight;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 1.6, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        if (mountRef.current) mountRef.current.appendChild(renderer.domElement);

        video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("playsinline", "");
        video.style.display = "none";
        videoRef.current = video;

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" }, audio: false })
            .then((stream) => {
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
            new THREE.MeshStandardMaterial({ color: 0x000000 })
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

        const geoWatch = navigator.geolocation.watchPosition(
            (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.error(err),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );

        let deviceHeading = 0;
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

        const animate = () => {
            requestAnimationFrame(animate);
            if (video.readyState >= video.HAVE_CURRENT_DATA) {
                if (userCoords && arrowGroupRef.current && targetCoords) {
                    const bearing = computeBearing(
                        userCoords.lat,
                        userCoords.lng,
                        targetCoords.lat,
                        targetCoords.lng
                    );
                    arrowGroupRef.current.rotation.y = bearing - deviceHeading;
                }
                if (videoTexture) videoTexture.needsUpdate = true;
                renderer.render(scene, camera);
            }
        };
        animate();

        return () => {
            if (mountRef.current && renderer) mountRef.current.removeChild(renderer.domElement);
            if (video && video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
            navigator.geolocation.clearWatch(geoWatch);
            window.removeEventListener("deviceorientation", handleOrientation);
        };
    }, [arrowStyle, userCoords, targetCoords, backendUrl]);
    // ----------------------
    // Original AR logic ends here
    // ----------------------

    return (
        <>
            <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
            {/* Chatbox overlay */}
            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(255, 255, 255, 0.85)",
                    borderRadius: 12,
                    padding: 10,
                    width: "90%",
                    maxWidth: 400,
                    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                }}
            >
                <div style={{ maxHeight: 150, overflowY: "auto", marginBottom: 8 }}>
                    {chatHistory.map((c, i) => (
                        <div key={i}>
                            <strong>You:</strong> {c.user} <br />
                            <strong>Bot:</strong> {c.bot}
                        </div>
                    ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type a message..."
                        style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
                    />
                    <button
                        onClick={sendMessage}
                        style={{
                            background: "#007bff",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "8px 12px",
                            cursor: "pointer",
                        }}
                    >
                        Send
                    </button>
                </div>
            </div>
        </>
    );
}

export default ARView;
