import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const SIT_FRONT_GATE = {
    lat: 13.331624095990712,
    lon: 77.12728232145311,
};

const ARView = ({ onBack }) => {
    const containerRef = useRef(null);
    const arrowRef = useRef(null);

    useEffect(() => {
        let scene, camera, renderer, arrow, watchId;
        const loader = new GLTFLoader();

        // === Scene, Camera, Renderer ===
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1.6, 0);

        renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);

        // === Lighting ===
        const light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(0, 5, 5);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));

        // === Load Arrow Model ===
        loader.load(
            "/RedArrow.glb",
            (gltf) => {
                arrow = gltf.scene;
                arrow.scale.set(0.4, 0.4, 0.4);
                arrow.rotation.x = -Math.PI / 6; // Tilt forward
                arrow.position.set(0, 0, -2); // In front of camera
                scene.add(arrow);
                arrowRef.current = arrow;
                console.log("✅ Arrow model loaded.");
            },
            undefined,
            (error) => console.error("❌ Arrow load error:", error)
        );

        // === Camera Feed ===
        const video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("playsinline", "");
        video.style.position = "fixed";
        video.style.top = "0";
        video.style.left = "0";
        video.style.width = "100vw";
        video.style.height = "100vh";
        video.style.objectFit = "cover";
        video.style.zIndex = "-1";
        document.body.appendChild(video);

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then((stream) => (video.srcObject = stream))
            .catch((err) => console.error("Camera access error:", err));

        // === Utility: Bearing Calculation ===
        function calculateBearing(lat1, lon1, lat2, lon2) {
            const toRad = (deg) => (deg * Math.PI) / 180;
            const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
            const x =
                Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
            const brng = Math.atan2(y, x);
            return ((brng * 180) / Math.PI + 360) % 360;
        }

        // === Device Orientation + GPS Tracking ===
        let deviceHeading = 0; // current compass heading
        let targetBearing = 0; // angle to target
        let relativeBearing = 0;

        // Listen for orientation changes
        window.addEventListener("deviceorientation", (event) => {
            if (event.absolute || event.webkitCompassHeading !== undefined) {
                // iOS Safari
                deviceHeading = event.webkitCompassHeading || 0;
            } else if (event.alpha !== null) {
                // Android Chrome (convert alpha to compass heading)
                deviceHeading = 360 - event.alpha;
            }
        });

        // Watch GPS position
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    targetBearing = calculateBearing(latitude, longitude, SIT_FRONT_GATE.lat, SIT_FRONT_GATE.lon);
                },
                (err) => console.error("Geolocation error:", err),
                { enableHighAccuracy: true }
            );
        }

        // === Animate Loop ===
        const animate = () => {
            requestAnimationFrame(animate);

            if (arrowRef.current) {
                relativeBearing = ((targetBearing - deviceHeading) + 360) % 360;
                const targetRotation = THREE.MathUtils.degToRad(relativeBearing);
                // Smooth interpolation for smoother motion
                arrowRef.current.rotation.y += (targetRotation - arrowRef.current.rotation.y) * 0.1;
            }

            renderer.render(scene, camera);
        };
        animate();

        // === Resize ===
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);

        // === Cleanup ===
        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("deviceorientation", () => {});
            if (renderer) {
                renderer.dispose();
                if (renderer.domElement && containerRef.current?.contains(renderer.domElement)) {
                    containerRef.current.removeChild(renderer.domElement);
                }
            }
            document.querySelectorAll("video").forEach((v) => v.remove());
        };
    }, []);

    return (
        <div ref={containerRef} style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
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
        </div>
    );
};

export default ARView;
