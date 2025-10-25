import React, { useEffect, useRef } from "react";
import * as THREE from "three";

function ARView({ path }) {
    const mountRef = useRef();
    const videoRef = useRef();

    useEffect(() => {
        let renderer, scene, camera, video;

        const width = window.innerWidth;
        const height = window.innerHeight;

        // Scene & Camera
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 1.6, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0); // Transparent background
        if (mountRef.current) mountRef.current.appendChild(renderer.domElement);

        // Video element as background
        video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("playsinline", "");
        video.style.position = "absolute";
        video.style.top = "0";
        video.style.left = "0";
        video.style.width = "100vw";
        video.style.height = "100vh";
        video.style.objectFit = "cover"; // Ensures full screen
        videoRef.current = video;
        document.body.appendChild(video);

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" }, audio: false })
            .then((stream) => {
                video.srcObject = stream;
                video.play();
            })
            .catch((err) => console.error("Error accessing camera: ", err));

        // Arrows for path (overlay in 3D)
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        path.forEach(([lat, lng], index) => {
            if (index === 0) return;
            const [prevLat, prevLng] = path[index - 1];
            const dir = new THREE.Vector3(lng - prevLng, 0, lat - prevLat);
            const length = dir.length();
            const arrow = new THREE.ArrowHelper(
                dir.clone().normalize(),
                new THREE.Vector3(prevLng, 0, prevLat),
                length,
                0xff0000
            );
            scene.add(arrow);
        });

        // Animate
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        // Cleanup
        return () => {
            if (mountRef.current && renderer?.domElement) mountRef.current.removeChild(renderer.domElement);
            if (video) document.body.removeChild(video);
            if (video && video.srcObject) video.srcObject.getTracks().forEach((track) => track.stop());
        };
    }, [path]);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh", position: "absolute", top: 0, left: 0 }} />;
}

export default ARView;
