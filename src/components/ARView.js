import React, { useEffect, useRef } from "react";
import * as THREE from "three";

function ARView({ path, arrowStyle }) {
    const mountRef = useRef();
    const videoRef = useRef();

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

        // --- Arrow ---
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

        // --- Dummy SIT Front Gate target ---
        const sitFrontGate = new THREE.Vector3(10, 1.6, -20);

        // --- Device Orientation handler ---
        const handleOrientation = (event) => {
            const { alpha, beta, gamma } = event; // yaw, pitch, roll
            if (alpha === null || beta === null || gamma === null) return;

            const euler = new THREE.Euler(
                THREE.MathUtils.degToRad(beta),
                THREE.MathUtils.degToRad(alpha),
                -THREE.MathUtils.degToRad(gamma),
                "YXZ"
            );
            camera.setRotationFromEuler(euler);
        };

        window.addEventListener("deviceorientation", handleOrientation, true);

        // --- Animation ---
        const animate = () => {
            requestAnimationFrame(animate);

            const localTarget = camera.worldToLocal(sitFrontGate.clone());
            const direction = new THREE.Vector3().subVectors(localTarget, arrowGroup.position).normalize();

            const targetQuaternion = new THREE.Quaternion();
            targetQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
            arrowGroup.quaternion.slerp(targetQuaternion, 0.05);

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

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default ARView;
