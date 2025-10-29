import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const ARView = ({ onBack }) => {
    const mountRef = useRef(null);
    const videoRef = useRef(null);

    useEffect(() => {
        // === CAMERA FEED ===
        const video = document.createElement("video");
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.style.position = "fixed";
        video.style.top = 0;
        video.style.left = 0;
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        videoRef.current = video;
        document.body.appendChild(video);

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then((stream) => (video.srcObject = stream))
            .catch((err) => console.error("Camera access failed:", err));

        // === THREE.JS SETUP ===
        const scene = new THREE.Scene();
        scene.background = null;

        const camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        camera.position.set(0, 0, 3);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        mountRef.current.appendChild(renderer.domElement);

        // === LIGHTS ===
        scene.add(new THREE.AmbientLight(0xffffff, 2));
        const dir = new THREE.DirectionalLight(0xffffff, 3);
        dir.position.set(5, 5, 5);
        scene.add(dir);

        // === TEST BOX ===
        const testBox = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );
        testBox.position.set(0, 0, -3); // place directly in front
        scene.add(testBox);

        console.log("✅ Added test box at", testBox.position);

        // === LOAD ARROW MODEL (hidden for now) ===
        const loader = new GLTFLoader();
        loader.load(
            "/RedArrow.glb",
            (gltf) => {
                const arrow = gltf.scene;
                arrow.scale.set(0.1, 0.1, 0.1);
                arrow.rotation.x = -Math.PI / 3;
                arrow.position.set(0, -0.5, -3);
                arrow.visible = true;
                scene.add(arrow);
                console.log("✅ Arrow model loaded at", arrow.position);
            },
            undefined,
            (err) => console.error("❌ Failed to load arrow:", err)
        );

        // === ANIMATION LOOP ===
        const animate = () => {
            requestAnimationFrame(animate);
            testBox.rotation.y += 0.01; // slow rotation
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (videoRef.current) document.body.removeChild(videoRef.current);
            if (mountRef.current?.firstChild)
                mountRef.current.removeChild(mountRef.current.firstChild);
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
