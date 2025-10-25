import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function ARView({ path, arrowStyle }) {
    const mountRef = useRef();
    const videoRef = useRef();
    const [currentIndex, setCurrentIndex] = useState(0); // For simulating movement

    useEffect(() => {
        if (!path || path.length < 2) return;

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
        renderer.setPixelRatio(window.devicePixelRatio);
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
                videoTexture = new THREE.VideoTexture(video);
                scene.background = videoTexture;
            })
            .catch((err) => console.error("Error accessing camera: ", err));

        // Arrow group with one cylinder + one cone (unchanged)
        const arrowGroup = new THREE.Group();

        const cylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        cylinder.position.set(0, arrowStyle?.y || -0.5, arrowStyle?.z || -1);
        cylinder.rotation.x = -Math.PI / 2;
        arrowGroup.add(cylinder);

        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.2, 16),
            new THREE.MeshStandardMaterial({ color: 0x000000 })
        );
        cone.position.set(0, (arrowStyle?.y || -0.5) + 0.15, arrowStyle?.z || -1);
        cone.rotation.x = -Math.PI / 2;
        arrowGroup.add(cone);

        camera.add(arrowGroup);
        scene.add(camera);

        // Lighting
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 10, 10);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        // Simulate arrow pointing along the path
        let step = 0;
        const steps = 200; // steps per segment
        const interval = setInterval(() => {
            if (currentIndex >= path.length - 1) return;

            const start = path[currentIndex];
            const end = path[currentIndex + 1];

            // Compute direction vector for arrow
            const dir = new THREE.Vector3(end.lng - start.lng, 0, end.lat - start.lat).normalize();
            arrowGroup.lookAt(dir.x, dir.y, dir.z);

            step++;
            if (step > steps) {
                step = 0;
                setCurrentIndex((prev) => Math.min(prev + 1, path.length - 2));
            }
        }, 50);

        // Animate
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        // Cleanup
        return () => {
            clearInterval(interval);
            if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach((track) => track.stop());
            }
        };
    }, [path, arrowStyle, currentIndex]);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default ARView;
