import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const ARView = () => {
    const mountRef = useRef(null);

    useEffect(() => {
        let renderer, scene, camera, video, videoTexture, mesh;

        // === Scene Setup ===
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            1000
        );
        camera.position.z = 1;

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);

        // ✅ Updated for Three.js r165+
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        mountRef.current.appendChild(renderer.domElement);

        // === Video Texture ===
        video = document.createElement("video");
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        navigator.mediaDevices
            .getUserMedia({ video: true })
            .then((stream) => {
                video.srcObject = stream;
                video.play();
            })
            .catch((err) => console.error("Camera access error:", err));

        videoTexture = new THREE.VideoTexture(video);

        // ✅ Updated for new property
        videoTexture.colorSpace = THREE.SRGBColorSpace;

        const geometry = new THREE.PlaneGeometry(1.6, 0.9);
        const material = new THREE.MeshBasicMaterial({ map: videoTexture });
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // === Resize Handler ===
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);

        // === Smooth Render Loop ===
        renderer.setAnimationLoop(null);
        function renderLoop() {
            requestAnimationFrame(renderLoop);
            if (video.readyState >= video.HAVE_CURRENT_DATA) {
                renderer.render(scene, camera);
            }
        }
        renderLoop();

        // === Cleanup ===
        return () => {
            window.removeEventListener("resize", handleResize);
            mountRef.current.removeChild(renderer.domElement);
            if (video.srcObject) {
                video.srcObject.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
};

export default ARView;
