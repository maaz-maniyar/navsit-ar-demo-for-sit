import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function ARView({ nextNodeCoords, onBack }) {
    const containerRef = useRef(null);
    const [heading, setHeading] = useState(0);
    const [userLocation, setUserLocation] = useState(null);
    const [cameraStream, setCameraStream] = useState(null);

    useEffect(() => {
        let scene, camera, renderer, arrow;
        let animationId;

        // Initialize Three.js Scene
        //...
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        containerRef.current.appendChild(renderer.domElement);

        // Ground plane (for reference)
        const planeGeometry = new THREE.PlaneGeometry(100, 100);
        const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        scene.add(plane);

        // Arrow (direction indicator)
        const arrowGeometry = new THREE.ConeGeometry(0.5, 2, 32);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.position.y = 1; // Raise slightly above ground
        scene.add(arrow);

        camera.position.y = 1.6; // Eye level height

        // Animate loop
        const animate = () => {
            animationId = requestAnimationFrame(animate);

            if (userLocation && nextNodeCoords && heading !== null) {
                const bearing = computeBearing(userLocation, nextNodeCoords);
                const angle = THREE.MathUtils.degToRad(bearing - heading);
                arrow.rotation.y = angle;
            }

            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(animationId);
            if (renderer) renderer.dispose();
            if (containerRef.current && renderer.domElement) {
                containerRef.current.removeChild(renderer.domElement);
            }
        };
    }, [userLocation, heading, nextNodeCoords]);

    // Get user GPS
    useEffect(() => {
        const geoWatch = navigator.geolocation.watchPosition(
            (pos) => {
                setUserLocation({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                });
            },
            (err) => console.error("GPS error:", err),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
        return () => navigator.geolocation.clearWatch(geoWatch);
    }, []);

    // Get compass heading
    useEffect(() => {
        const handleOrientation = (event) => {
            if (event.absolute && event.alpha !== null) {
                let compassHeading = 360 - event.alpha; // Convert from device rotation
                setHeading(compassHeading);
            }
        };
        window.addEventListener("deviceorientationabsolute", handleOrientation, true);
        return () => window.removeEventListener("deviceorientationabsolute", handleOrientation);
    }, []);

    // Start camera stream as background
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                setCameraStream(stream);
                const video = document.createElement("video");
                video.srcObject = stream;
                video.play();
                video.style.position = "fixed";
                video.style.top = 0;
                video.style.left = 0;
                video.style.width = "100vw";
                video.style.height = "100vh";
                video.style.objectFit = "cover";
                video.style.zIndex = "-1";
                video.setAttribute("playsinline", "");
                document.body.appendChild(video);
            } catch (err) {
                console.error("Camera error:", err);
            }
        };
        startCamera();

        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach((track) => track.stop());
            }
            const videos = document.querySelectorAll("video");
            videos.forEach((v) => v.remove());
        };
    }, []);

    return (
        <div>
            <button
                onClick={onBack}
                style={{
                    position: "fixed",
                    top: "10px",
                    left: "10px",
                    padding: "10px 15px",
                    background: "#222",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    zIndex: 10,
                }}
            >
                Back to Chat
            </button>

            <div ref={containerRef} style={{ width: "100vw", height: "100vh" }} />
        </div>
    );
}

// Utility: bearing between two GPS coordinates
function computeBearing(start, end) {
    const lat1 = THREE.MathUtils.degToRad(start.lat);
    const lon1 = THREE.MathUtils.degToRad(start.lon);
    const lat2 = THREE.MathUtils.degToRad(end[0]);
    const lon2 = THREE.MathUtils.degToRad(end[1]);
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const brng = (THREE.MathUtils.radToDeg(Math.atan2(y, x)) + 360) % 360;
    return brng;
}
