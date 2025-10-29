import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const SIT_FRONT_GATE = {
    lat: 13.331624095990712,
    lon: 77.12728232145311,
};

const ARView = ({ onBack }) => {
    const containerRef = useRef(null);
    const arrowGroupRef = useRef(null);
    const [debug, setDebug] = useState({ heading: 0, bearing: 0, relative: 0 });

    useEffect(() => {
        let scene, camera, renderer, watchId;
        const loader = new GLTFLoader();

        // === Scene, Camera, Renderer ===
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

        // === Load Arrow ===
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

        // === Bearing Calculator ===
        const toRad = (deg) => (deg * Math.PI) / 180;
        function calculateBearing(lat1, lon1, lat2, lon2) {
            const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
            const x =
                Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                Math.sin(toRad(lat1)) *
                Math.cos(toRad(lat2)) *
                Math.cos(toRad(lon2 - lon1));
            const brng = Math.atan2(y, x);
            return ((brng * 180) / Math.PI + 360) % 360;
        }

        // === Tracking ===
        let deviceHeading = 0;
        let targetBearing = 0;
        let bearingOffset = 90; // 🔧 manual offset (try 0, 90, 180, -90)

        window.addEventListener("deviceorientation", (event) => {
            if (event.webkitCompassHeading !== undefined) {
                deviceHeading = event.webkitCompassHeading; // iOS
            } else if (event.alpha !== null) {
                deviceHeading = 360 - event.alpha; // Android
            }
        });

        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    targetBearing = calculateBearing(
                        latitude,
                        longitude,
                        SIT_FRONT_GATE.lat,
                        SIT_FRONT_GATE.lon
                    );
                },
                (err) => console.error("GPS error:", err),
                { enableHighAccuracy: true }
            );
        }

        // === Animate ===
        const animate = () => {
            requestAnimationFrame(animate);

            if (arrowGroupRef.current) {
                let relative = (targetBearing - deviceHeading + bearingOffset + 360) % 360;
                const targetY = THREE.MathUtils.degToRad(relative);
                arrowGroupRef.current.rotation.y += (targetY - arrowGroupRef.current.rotation.y) * 0.15;

                setDebug({
                    heading: deviceHeading.toFixed(1),
                    bearing: targetBearing.toFixed(1),
                    relative: relative.toFixed(1),
                });
            }

            renderer.render(scene, camera);
        };
        animate();

        // === Resize ===
        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", onResize);

        // === Cleanup ===
        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
            window.removeEventListener("resize", onResize);
            if (renderer) renderer.dispose();
            document.querySelectorAll("video").forEach((v) => v.remove());
        };
    }, []);

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

            {/* === Debug Overlay === */}
            <div
                style={{
                    position: "absolute",
                    bottom: 20,
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
            </div>
        </>
    );
};

export default ARView;
