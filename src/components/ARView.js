import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const ARView = ({ nextNodeCoords, onBack }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!nextNodeCoords) return;
        const container = containerRef.current;
        if (!container) return;

        // === Scene, Camera, Renderer ===
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            100
        );

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(renderer.domElement);

        // === Video background ===
        const video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        video.style.display = "none";

        navigator.mediaDevices
            .getUserMedia({
                video: { facingMode: { exact: "environment" } },
                audio: false,
            })
            .then((stream) => {
                video.srcObject = stream;
                video.play();

                const videoTexture = new THREE.VideoTexture(video);
                videoTexture.minFilter = THREE.LinearFilter;
                videoTexture.magFilter = THREE.LinearFilter;
                videoTexture.format = THREE.RGBFormat;

                const videoGeometry = new THREE.PlaneGeometry(2, 2);
                const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
                const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
                videoMesh.material.depthTest = false;
                videoMesh.material.depthWrite = false;

                const videoScene = new THREE.Scene();
                const videoCamera = new THREE.Camera();
                videoScene.add(videoMesh);

                // === Lighting ===
                const ambientLight = new THREE.AmbientLight(0xffffff, 1);
                scene.add(ambientLight);

                // === Load Arrow ===
                const loader = new GLTFLoader();
                let arrow;
                loader.load(
                    process.env.PUBLIC_URL + "/models/RedArrow.glb",
                    (gltf) => {
                        arrow = gltf.scene;
                        arrow.scale.set(1.5, 1.5, 1.5);
                        arrow.position.set(0, -1, -3);
                        scene.add(arrow);
                    },
                    undefined,
                    (err) => console.error("GLB load error:", err)
                );

                // === Compass-based rotation ===
                window.addEventListener("deviceorientationabsolute", (e) => {
                    const heading = THREE.MathUtils.degToRad(e.alpha || 0);
                    if (arrow) arrow.rotation.y = heading;
                });

                // === Animate ===
                const animate = () => {
                    requestAnimationFrame(animate);
                    renderer.autoClear = false;
                    renderer.clear();
                    renderer.render(videoScene, videoCamera);
                    renderer.render(scene, camera);
                };
                animate();
            })
            .catch((err) => {
                console.error("Camera access error:", err);
                alert("Camera permission denied or not available.");
            });

        // === Cleanup ===
        return () => {
            if (container && renderer.domElement && container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
            renderer.dispose();
            scene.clear();
        };
    }, [nextNodeCoords]);

    return (
        <div
            ref={containerRef}
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
                    top: 20,
                    left: 20,
                    padding: "10px 20px",
                    background: "#ff4757",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "16px",
                }}
            >
                Back
            </button>
        </div>
    );
};

export default ARView;
