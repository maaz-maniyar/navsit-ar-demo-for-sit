// src/components/ARView.js
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

function ARView({ onBack }) {
    const mountRef = useRef(null);

    useEffect(() => {
        let renderer, camera, scene, video, videoTexture, videoMesh, arrow;
        let currentHeading = 0;
        const targetCoords = { lat: 13.331624095990712, lon: 77.12728232145311 };

        // === VIDEO SETUP ===
        video = document.createElement("video");
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then((stream) => {
                video.srcObject = stream;
                video.play();
            })
            .catch((err) => console.error("Camera access failed:", err));

        // === THREE.JS SETUP ===
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.z = 0;

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);
        mountRef.current.appendChild(renderer.domElement);

        // === VIDEO BACKGROUND ===
        videoTexture = new THREE.VideoTexture(video);
        const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
        const updateVideoPlane = () => {
            if (video.videoWidth && video.videoHeight) {
                const videoAspect = video.videoWidth / video.videoHeight;
                const screenAspect = window.innerWidth / window.innerHeight;

                let geometry;
                if (videoAspect > screenAspect) {
                    geometry = new THREE.PlaneGeometry(16 * videoAspect, 16);
                } else {
                    geometry = new THREE.PlaneGeometry(16, 16 / videoAspect);
                }

                if (videoMesh) scene.remove(videoMesh);
                videoMesh = new THREE.Mesh(geometry, videoMaterial);
                videoMesh.position.z = -10;
                scene.add(videoMesh);
            }
        };

        video.addEventListener("loadedmetadata", updateVideoPlane);
        window.addEventListener("resize", () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            updateVideoPlane();
        });

        // === LIGHTS ===
        const ambient = new THREE.AmbientLight(0xffffff, 2);
        const directional = new THREE.DirectionalLight(0xffffff, 1);
        directional.position.set(1, 1, 1);
        scene.add(ambient, directional);

        // === DEBUG CUBE ===
        const cube = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.3, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );
        cube.position.z = -2;
        scene.add(cube);

        // === LOAD ARROW MODEL ===
        const loader = new GLTFLoader();
        loader.load(
            "/RedArrow.glb",
            (gltf) => {
                arrow = gltf.scene;
                arrow.scale.set(1.5, 1.5, 1.5);
                arrow.rotation.x = -Math.PI / 4; // slanted forward
                arrow.position.set(0, -0.2, -2);
                scene.add(arrow);
            },
            undefined,
            (err) => console.error("Error loading arrow:", err)
        );

        // === BEARING CALCULATION ===
        const computeBearing = (lat1, lon1, lat2, lon2) => {
            const toRad = (deg) => (deg * Math.PI) / 180;
            const dLon = toRad(lon2 - lon1);
            const y = Math.sin(dLon) * Math.cos(toRad(lat2));
            const x =
                Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
            const brng = Math.atan2(y, x);
            return ((brng * 180) / Math.PI + 360) % 360;
        };

        // === GPS TRACKING ===
        let userLat = null;
        let userLon = null;

        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(
                (pos) => {
                    userLat = pos.coords.latitude;
                    userLon = pos.coords.longitude;
                },
                (err) => console.warn("GPS Error:", err),
                { enableHighAccuracy: true, maximumAge: 1000 }
            );
        }

        // === COMPASS TRACKING ===
        window.addEventListener("deviceorientationabsolute", (event) => {
            if (event.alpha != null) {
                currentHeading = 360 - event.alpha; // alpha gives compass heading
            }
        });

        // === ANIMATION LOOP ===
        const animate = () => {
            requestAnimationFrame(animate);
            cube.rotation.y += 0.01;

            if (arrow && userLat && userLon) {
                const bearing = computeBearing(userLat, userLon, targetCoords.lat, targetCoords.lon);
                const relativeAngle = ((bearing - currentHeading + 360) % 360) * (Math.PI / 180);
                arrow.rotation.y = relativeAngle;
            }

            renderer.render(scene, camera);
        };
        animate();

        // === CLEANUP ===
        return () => {
            if (mountRef.current?.firstChild)
                mountRef.current.removeChild(mountRef.current.firstChild);
            if (video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
            window.removeEventListener("resize", updateVideoPlane);
        };
    }, []);

    return (
        <div
            ref={mountRef}
            style={{
                height: "100vh",
                width: "100vw",
                position: "relative",
                overflow: "hidden",
                background: "black",
            }}
        >
            <button
                onClick={onBack}
                style={{
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    zIndex: 10,
                    background: "rgba(0,0,0,0.6)",
                    color: "white",
                    border: "1px solid #fff",
                    borderRadius: "8px",
                    padding: "8px 12px",
                }}
            >
                ← Back
            </button>
        </div>
    );
}

export default ARView;
