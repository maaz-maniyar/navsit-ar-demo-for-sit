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
        renderer.setClearColor(0x000000, 0); // transparent background
        mountRef.current.appendChild(renderer.domElement);

        // === VIDEO BACKGROUND ===
        videoTexture = new THREE.VideoTexture(video);
        const videoGeometry = new THREE.PlaneGeometry(16, 9);
        const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
        const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
        videoMesh.position.z = -10;
        scene.add(videoMesh);

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
                arrow.scale.set(1.5, 1.5, 1.5); // make it large enough
                arrow.rotation.x = -Math.PI / 4; // tilt slightly forward
                arrow.position.set(0, -0.2, -2); // put just in front of cube
                scene.add(arrow);
                console.log("✅ Arrow model loaded and added to scene:", arrow);
            },
            undefined,
            (err) => console.error("❌ Error loading model:", err)
        );

        // === DEBUG BOX AT ARROW POSITION ===
        const debugBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        debugBox.position.set(0, -0.2, -2);
        scene.add(debugBox);

        // === ANIMATION LOOP ===
        const animate = () => {
            requestAnimationFrame(animate);
            cube.rotation.y += 0.01;
            if (arrow) arrow.rotation.y += 0.005; // slow rotation for visibility
            renderer.render(scene, camera);
        };
        animate();

        // === CLEANUP ===
        return () => {
            if (mountRef.current?.firstChild)
                mountRef.current.removeChild(mountRef.current.firstChild);
            if (video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
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
