import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const ARView = ({ onBack }) => {
    const mountRef = useRef(null);
    const videoRef = useRef(null);

    useEffect(() => {
        // === CAMERA SETUP ===
        const video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        video.style.position = "fixed";
        video.style.top = 0;
        video.style.left = 0;
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        videoRef.current = video;
        document.body.appendChild(video);

        // Request camera feed
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then((stream) => {
                video.srcObject = stream;
            })
            .catch((err) => {
                console.error("Camera access failed:", err);
            });

        // === THREE.JS SETUP ===
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.z = 3;

        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        mountRef.current.appendChild(renderer.domElement);

        // Lighting
        const light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(0, 1, 2);
        scene.add(light);

        // === LOAD THE ARROW MODEL ===
        const loader = new GLTFLoader();
        let arrow;
        loader.load("/RedArrow.glb", (gltf) => {
            arrow = gltf.scene;
            arrow.scale.set(0.5, 0.5, 0.5);
            arrow.rotation.x = -Math.PI / 2; // slant forward
            scene.add(arrow);
        });

        // === DEVICE ORIENTATION HANDLER ===
        const handleOrientation = (event) => {
            if (!arrow) return;

            const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
            const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0;
            const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;

            const euler = new THREE.Euler(beta, alpha, -gamma, "YXZ");
            arrow.setRotationFromEuler(euler);
        };

        window.addEventListener("deviceorientation", handleOrientation);

        // === ANIMATION LOOP ===
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        // === CLEANUP ===
        return () => {
            window.removeEventListener("deviceorientation", handleOrientation);
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
