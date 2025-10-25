import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function ARView({ path, arrowStyle }) {
    const mountRef = useRef();
    const videoRef = useRef();
    const [heading, setHeading] = useState("No orientation yet");

    useEffect(() => {
        let renderer, scene, camera, video, videoTexture, arrowGroup;
        const width = window.innerWidth;
        const height = window.innerHeight;

        // --- Scene & Camera ---
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 1.6, 0);

        // --- Renderer ---
        renderer = new THREE.WebGLRenderer({ antialias: true });
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

        // Cone (tip) → black
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.2, 16),
            new THREE.MeshStandardMaterial({ color: 0x000000 })
        );
        cone.position.y = 0.2;
        arrowGroup.add(cone);

        // Cylinder (stem) → white
        const cylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        cylinder.position.y = -0.1;
        arrowGroup.add(cylinder);

        arrowGroup.position.set(0, -0.5, -2);
        scene.add(arrowGroup); // <— note: attach to scene, not camera

        // --- Lighting ---
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(0, 2, 2);
        scene.add(dirLight);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        // --- Orientation Handling ---
        const handleOrientation = (event) => {
            if (event.absolute || event.alpha != null) {
                const alpha = event.alpha; // 0–360°
                setHeading(alpha.toFixed(1) + "°");

                // Convert compass heading to radians and invert so it matches camera orientation
                const rotationY = THREE.MathUtils.degToRad(-alpha);
                arrowGroup.rotation.set(0, rotationY, 0);
            }
        };

        const requestOrientationPermission = async () => {
            if (
                typeof DeviceOrientationEvent !== "undefined" &&
                typeof DeviceOrientationEvent.requestPermission === "function"
            ) {
                try {
                    const response = await DeviceOrientationEvent.requestPermission();
                    if (response === "granted") {
                        window.addEventListener("deviceorientation", handleOrientation, true);
                    } else {
                        console.warn("Orientation permission denied");
                    }
                } catch (e) {
                    console.error("Orientation permission error:", e);
                }
            } else {
                window.addEventListener("deviceorientation", handleOrientation, true);
            }
        };

        requestOrientationPermission();

        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        // --- Cleanup ---
        return () => {
            window.removeEventListener("deviceorientation", handleOrientation);
            if (mountRef.current?.contains(renderer.domElement)) {
                mountRef.current.removeChild(renderer.domElement);
            }
            if (video?.srcObject) {
                video.srcObject.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    return (
        <div>
            <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
            <div
                style={{
                    position: "absolute",
                    top: 20,
                    left: 20,
                    background: "rgba(0,0,0,0.5)",
                    color: "white",
                    padding: "8px",
                    borderRadius: "8px",
                }}
            >
                Heading: {heading}
            </div>
        </div>
    );
}

export default ARView;
