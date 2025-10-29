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

        // Create scene
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1.6, 0);

        renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);

        // Lighting
        const light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(0, 5, 5);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));

        // Load Arrow Model
        loader.load(
            "/RedArrow.glb",
            (gltf) => {
                arrow = gltf.scene;
                arrow.scale.set(0.4, 0.4, 0.4); // Adjust size
                arrow.rotation.x = -Math.PI / 6; // Tilt forward
                arrow.position.set(0, 0, -2); // Slightly in front of the camera
                scene.add(arrow);
                arrowRef.current = arrow;
                console.log("✅ Arrow model loaded and added to scene.");
            },
            undefined,
            (error) => {
                console.error("❌ Error loading arrow model:", error);
            }
        );

        // Camera feed setup
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
            .then((stream) => {
                video.srcObject = stream;
            })
            .catch((err) => console.error("Camera access error:", err));

        // Function to calculate bearing between two GPS points
        function calculateBearing(lat1, lon1, lat2, lon2) {
            const toRad = (deg) => (deg * Math.PI) / 180;
            const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
            const x =
                Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
            const brng = Math.atan2(y, x);
            return ((brng * 180) / Math.PI + 360) % 360;
        }

        // Track user location and rotation
        let currentBearing = 0;

        if (window.DeviceOrientationEvent) {
            window.addEventListener("deviceorientationabsolute", (event) => {
                if (event.alpha != null) {
                    currentBearing = event.alpha; // Compass heading
                }
            });
        }

        // Watch position
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const targetBearing = calculateBearing(latitude, longitude, SIT_FRONT_GATE.lat, SIT_FRONT_GATE.lon);
                    const relativeBearing = ((targetBearing - currentBearing) + 360) % 360;

                    if (arrowRef.current) {
                        arrowRef.current.rotation.y = THREE.MathUtils.degToRad(relativeBearing);
                    }
                },
                (err) => console.error("Geolocation error:", err),
                { enableHighAccuracy: true }
            );
        }

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        // Handle resize
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
            window.removeEventListener("resize", handleResize);
            if (renderer) {
                renderer.dispose();
                if (renderer.domElement && containerRef.current?.contains(renderer.domElement)) {
                    containerRef.current.removeChild(renderer.domElement);
                }
            }
            const videos = document.querySelectorAll("video");
            videos.forEach((v) => v.remove());
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
