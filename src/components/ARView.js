import React, { useEffect, useRef } from "react";
import * as THREE from "three";

function ARView({ path }) {
    const mountRef = useRef();
    const videoRef = useRef();

    useEffect(() => {
        let renderer, scene, camera, video, videoTexture;

        const width = window.innerWidth;
        const height = window.innerHeight;

        // Scene & Camera
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 0, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        if (mountRef.current) mountRef.current.appendChild(renderer.domElement);

        // Video background
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
                const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
                const videoGeometry = new THREE.PlaneGeometry(2, 2 * (height / width));
                const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
                videoMesh.position.set(0, 0, -1);
                scene.add(videoMesh);
            })
            .catch((err) => {
                console.error("Error accessing camera: ", err);
            });

        // Create proper 3D arrow
        const createArrow = (yOffset = -0.5, color = 0xff0000) => {
            const arrowGroup = new THREE.Group();

            // Shaft (cylinder along Y)
            const shaft = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 12);
            const shaftMat = new THREE.MeshBasicMaterial({ color });
            const shaftMesh = new THREE.Mesh(shaft, shaftMat);
            shaftMesh.position.y = 0.2; // shaft base at y=0
            arrowGroup.add(shaftMesh);

            // Head (cone on top)
            const head = new THREE.ConeGeometry(0.05, 0.15, 12);
            const headMat = new THREE.MeshBasicMaterial({ color });
            const headMesh = new THREE.Mesh(head, headMat);
            headMesh.position.y = 0.4 + 0.075; // top of shaft
            arrowGroup.add(headMesh);

            // Position arrow group in front of camera, lower screen
            arrowGroup.position.set(0, yOffset, -0.5);

            scene.add(arrowGroup);
        };

        path.forEach((_, i) => createArrow(-0.5 + i * 0.05));

        // Animate
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        // Cleanup
        return () => {
            if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach((track) => track.stop());
            }
        };
    }, [path]);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default ARView;
