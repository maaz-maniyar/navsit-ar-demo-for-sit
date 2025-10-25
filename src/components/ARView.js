import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function ARView({ path, arrowStyle }) {
    const mountRef = useRef();
    const videoRef = useRef();
    const [currentPosition, setCurrentPosition] = useState({
        lat: path[0].lat,
        lng: path[0].lng,
    });

    useEffect(() => {
        let renderer, scene, camera, video, videoTexture, arrowGroup;
        let simulationInterval;

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

        // Arrow group (cone + cylinder)
        arrowGroup = new THREE.Group();

        // Cone tip → black
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.2, 16),
            new THREE.MeshStandardMaterial({ color: 0x000000 })
        );
        cone.position.set(0, arrowStyle?.y || -0.5 + 0.15, arrowStyle?.z || -1);
        cone.rotation.x = -Math.PI / 2;
        arrowGroup.add(cone);

        // Cylinder stem → white
        const cylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        cylinder.position.set(0, arrowStyle?.y || -0.5, arrowStyle?.z || -1);
        cylinder.rotation.x = -Math.PI / 2;
        arrowGroup.add(cylinder);

        camera.add(arrowGroup);
        scene.add(camera);

        // Lighting
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 10, 10);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        // Function to update arrow direction toward next node
        const updateArrowDirection = (pos) => {
            if (!path || path.length < 2) return;
            const targetNode = path[1]; // always point to the next node
            const dx = targetNode.lng - pos.lng;
            const dz = targetNode.lat - pos.lat;
            const angle = Math.atan2(dx, dz); // rotation around y-axis
            arrowGroup.rotation.set(0, angle, 0);
        };

        // Animate
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        // **Simulate movement along path**
        let step = 0;
        const steps = 200; // number of steps between nodes
        const start = path[0];
        const end = path[1];
        simulationInterval = setInterval(() => {
            const lat = start.lat + ((end.lat - start.lat) * step) / steps;
            const lng = start.lng + ((end.lng - start.lng) * step) / steps;
            const newPos = { lat, lng };
            setCurrentPosition(newPos);
            updateArrowDirection(newPos);
            step++;
            if (step > steps) clearInterval(simulationInterval);
        }, 50); // adjust speed here (50ms per step)

        // Cleanup
        return () => {
            if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach((track) => track.stop());
            }
            clearInterval(simulationInterval);
        };
    }, [path, arrowStyle]);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default ARView;
