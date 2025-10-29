import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const ARView = ({ onBack }) => {
    const mountRef = useRef(null);

    useEffect(() => {
        let renderer, camera, scene, video, videoTexture, arrow;

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
        renderer.setClearColor(0x000000, 0); // transparent
        mountRef.current.appendChild(renderer.domElement);

        // === VIDEO TEXTURE AS BACKGROUND ===
        videoTexture = new THREE.VideoTexture(video);
        const videoGeometry = new THREE.PlaneGeometry(16, 9);
        videoGeometry.scale(1, 1, 1);
        const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
        const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
        videoMesh.position.z = -5;
        scene.add(videoMesh);

        // === LIGHTS ===
        const ambient = new THREE.AmbientLight(0xffffff, 2);
        scene.add(ambient);

        // === DEBUG CUBE (just to verify rendering) ===
        const cube = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5),
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
                arrow.scale.set(0.1, 0.1, 0.1);
                arrow.rotation.x = -Math.PI / 3; // tilt forward
                arrow.position.set(0, -0.5, -2);
                scene.add(arrow);
                console.log("✅ Arrow model loaded");
            },
            undefined,
            (err) => console.error("❌ Error loading model:", err)
        );

        // === ANIMATION LOOP ===
        const animate = () => {
            requestAnimationFrame(animate);
            if (cube) cube.rotation.y += 0.01;
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (mountRef.current?.firstChild)
                mountRef.current.removeChild(mountRef.current.firstChild);
            if (video.srcObject) {
                video.srcObject.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    return (
        <div
            ref={mountRef}
            style={{
                width: "100vw",
                height: "100vh",
                overflow: "hidden",
                position: "relative",
            }}
        >
            <button
                onClick={onBack}
                style={{
                    position: "absolute",
                    top: "20px",
                    left: "20px",
                    zIndex: 10,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: "rgba(255,255,255,0.8)",
                }}
            >
                Back
            </button>
        </div>
    );
};

export default ARView;
