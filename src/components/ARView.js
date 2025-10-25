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
        camera.position.set(0, 1.6, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        if (mountRef.current) mountRef.current.appendChild(renderer.domElement);

        // Video (mobile camera)
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

                // Video as background plane
                videoTexture = new THREE.VideoTexture(video);
                const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
                const aspect = width / height;
                const videoGeometry = new THREE.PlaneGeometry(2 * aspect, 2); // full-screen
                const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
                videoMesh.position.z = -1; // always behind arrows
                scene.add(videoMesh);
            })
            .catch((err) => {
                console.error("Error accessing camera: ", err);
            });

        // 3D Arrows for path
        path.forEach(([lat, lng], index) => {
            if (index === 0) return; // skip first
            const [prevLat, prevLng] = path[index - 1];

            // Calculate direction and distance
            const dir = new THREE.Vector3(lng - prevLng, 0, lat - prevLat);
            const length = dir.length();
            const normalizedDir = dir.clone().normalize();

            // Arrow components: cylinder + cone
            const shaftGeometry = new THREE.CylinderGeometry(0.01, 0.01, length * 0.8, 8);
            const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
            shaft.position.y = 0.05;
            shaft.rotation.z = Math.atan2(normalizedDir.x, normalizedDir.z);

            const headGeometry = new THREE.ConeGeometry(0.03, length * 0.2, 8);
            const headMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const head = new THREE.Mesh(headGeometry, headMaterial);
            head.position.y = 0.05;
            head.position.z = length * 0.5;
            head.rotation.z = Math.atan2(normalizedDir.x, normalizedDir.z);

            const arrowGroup = new THREE.Group();
            arrowGroup.add(shaft);
            arrowGroup.add(head);

            // Place arrow at start of segment
            arrowGroup.position.set(prevLng, 0, prevLat);
            scene.add(arrowGroup);
        });

        // Animate
        const animate = function () {
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
