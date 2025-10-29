import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const SIT_FRONT_GATE = {
    lat: 13.331624095990712,
    lon: 77.12728232145311,
};

const ARView = ({ onBack }) => {
    const containerRef = useRef(null);
    const arrowGroupRef = useRef(null);

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
        scene.add(new THREE.AmbientLight(0xffffff, 1));
        const dirLight = new THREE.DirectionalLight(0xffffff, 2);
        dirLight.position.set(0, 5, 5);
        scene.add(dirLight);

        // === Create Arrow Group (so we can rotate the whole group) ===
        const arrowGroup = new THREE.Group();
        arrowGroup.position.set(0, 0, -3); // 3m in front of camera
        scene.add(arrowGroup);
        arrowGroupRef.current = arrowGroup;

        // === Load Arrow Model ===
        loader.load(
            "/RedArrow.glb",
            (gltf) => {
                const arrowModel = gltf.scene;
                arrowModel.scale.set(0.4, 0.4, 0.4);
                arrowModel.rotation.x = -Math.PI / 4; // slant forward
                arrowModel.position.set(0, -0.5, 0);
                arrowGroup.add(arrowModel);
                console.log("✅ Arrow model loaded");
            },
            undefined,
            (error) => console.error("❌ Error loading arrow:", error)
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
                Math.sin(toRad(lat1)) *
                Math.cos(toRad(lat2)) *
                Math.cos(toRad(lon2 - lon1));
            const brng = Math.atan2(y, x);
            return ((brng * 180) / Math.PI + 360) % 360;
        }

        // === Orientation & Location Tracking ===
        let deviceHeading = 0;
        let targetBearing = 0;

        window.addEventListener("deviceorientation", (event) => {
            if (event.webkitCompassHeading !== undefined) {
                deviceHeading = event.webkitCompassHeading;
            } else if (event.alpha !== null) {
                deviceHeading = 360 - event.alpha;
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

        // === Animate Rotation ===
        const animate = () => {
            requestAnimationFrame(animate);

            if (arrowGroupRef.current) {
                // Calculate the relative angle between device heading and target bearing
                const relativeBearing = ((targetBearing - deviceHeading) + 360) % 360;
                const targetRotationY = THREE.MathUtils.degToRad(relativeBearing);

                // Smoothly rotate the arrow group
                arrowGroupRef.current.rotation.y +=
                    (targetRotationY - arrowGroupRef.current.rotation.y) * 0.15;
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
            if (renderer) renderer.dispose();
            document.querySelectorAll("video").forEach((v) => v.remove());
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
        >
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
