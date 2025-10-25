import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function ARView({ path, arrowStyle }) {
    const mountRef = useRef();
    const videoRef = useRef();
    const [userCoords, setUserCoords] = useState(null);
    const [deviceHeading, setDeviceHeading] = useState(0);

    useEffect(() => {
        let renderer, scene, camera, video, videoTexture, arrowGroup;
        const width = window.innerWidth;
        const height = window.innerHeight;

        // --- Scene & Camera ---
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 1.6, 0);

        // --- Renderer ---
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        mountRef.current?.appendChild(renderer.domElement);

        // --- Camera Feed ---
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
                scene.background = videoTexture;
            })
            .catch((err) => console.error("Error accessing camera:", err));

        // --- Arrow setup ---
        arrowGroup = new THREE.Group();

        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.2, 16),
            new THREE.MeshStandardMaterial({ color: 0x000000 })
        );
        cone.position.y = 0.2;
        arrowGroup.add(cone);

        const cylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        cylinder.position.y = -0.1;
        arrowGroup.add(cylinder);

        arrowGroup.position.set(0, -0.5, -2);
        camera.add(arrowGroup);
        scene.add(camera);

        // --- Lighting ---
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(0, 2, 2);
        scene.add(dirLight);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        // --- SIT Front Gate coordinates ---
        const sitFrontGate = { lat: 13.331748, lon: 77.127378 };

        // --- Track user GPS position ---
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setUserCoords({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                });
            },
            (err) => console.error("GPS error:", err),
            { enableHighAccuracy: true, maximumAge: 1000 }
        );

        // --- Bearing calculation ---
        const toRad = (deg) => (deg * Math.PI) / 180;
        const calculateBearing = (lat1, lon1, lat2, lon2) => {
            const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
            const x =
                Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
            let brng = Math.atan2(y, x);
            brng = (brng * 180) / Math.PI;
            return (brng + 360) % 360;
        };

        // --- Handle device orientation with permissions ---
        const requestOrientationPermission = async () => {
            if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
                try {
                    const response = await DeviceOrientationEvent.requestPermission();
                    if (response === "granted") {
                        window.addEventListener("deviceorientation", handleOrientation, true);
                    }
                } catch (e) {
                    console.error("Orientation permission denied:", e);
                }
            } else {
                window.addEventListener("deviceorientationabsolute", handleOrientation, true);
                window.addEventListener("deviceorientation", handleOrientation, true);
            }
        };

        const handleOrientation = (event) => {
            if (event.alpha != null) {
                // Use alpha (0–360°) as compass heading
                setDeviceHeading(event.alpha);
            }
        };

        requestOrientationPermission();

        // --- Animate ---
        const animate = () => {
            requestAnimationFrame(animate);

            if (userCoords) {
                const bearingToTarget = calculateBearing(
                    userCoords.lat,
                    userCoords.lon,
                    sitFrontGate.lat,
                    sitFrontGate.lon
                );

                // Compute relative rotation
                const relativeBearing = THREE.MathUtils.degToRad(bearingToTarget - deviceHeading);
                arrowGroup.rotation.y = relativeBearing;
            }

            renderer.render(scene, camera);
        };
        animate();

        // --- Cleanup ---
        return () => {
            navigator.geolocation.clearWatch(watchId);
            window.removeEventListener("deviceorientation", handleOrientation);
            window.removeEventListener("deviceorientationabsolute", handleOrientation);
            if (mountRef.current?.contains(renderer.domElement)) {
                mountRef.current.removeChild(renderer.domElement);
            }
            if (video?.srcObject) {
                video.srcObject.getTracks().forEach((t) => t.stop());
            }
        };
    }, [path, arrowStyle]);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default ARView;
