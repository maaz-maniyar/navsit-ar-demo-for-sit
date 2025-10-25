import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function ARView({ path, arrowStyle }) {
    const mountRef = useRef();
    const videoRef = useRef();
    const [heading, setHeading] = useState("No orientation yet");

    useEffect(() => {
        let renderer, scene, camera, video, videoTexture;

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
        if (mountRef.current) mountRef.current.appendChild(renderer.domElement);

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

        // --- Arrow setup (exact same structure that worked) ---
        const arrowGroup = new THREE.Group();

        // Cone (tip) → black
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.2, 16),
            new THREE.MeshStandardMaterial({ color: 0x000000 })
        );
        cone.position.set(0, arrowStyle?.y || -0.5, arrowStyle?.z || -1);
        cone.rotation.x = -Math.PI / 2; // point forward
        arrowGroup.add(cone);

        // Cylinder (stem) → white
        const cylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.25, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        // Slightly behind the cone
        cylinder.position.set(0, (arrowStyle?.y || -0.5) - 0.125, arrowStyle?.z || -1);
        cylinder.rotation.x = -Math.PI / 2;
        arrowGroup.add(cylinder);

        camera.add(arrowGroup);
        scene.add(camera);

        // --- Lighting ---
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 10, 10);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        // --- Orientation Handling (safe add) ---
        const handleOrientation = (event) => {
            if (event.absolute || event.alpha != null) {
                const alpha = event.alpha; // degrees
                setHeading(alpha.toFixed(1) + "°");

                // Convert to radians and rotate around Y-axis
                const rotationY = THREE.MathUtils.degToRad(-alpha);
                arrowGroup.rotation.y = rotationY;
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

        // --- Animate ---
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
    }, [path, arrowStyle]);

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
