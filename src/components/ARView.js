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

        // 3D Arrows in front of camera
        const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const arrowGroup = new THREE.Group();

        path.forEach((_, i) => {
            if (i === 0) return;

            // Create arrow pointing forward
            const cone = new THREE.Mesh(
                new THREE.ConeGeometry(0.05, 0.2, 16),
                arrowMaterial
            );
            cone.position.set(0, 0.5, -0.5 * i); // gradually in front of camera
            cone.rotation.x = -Math.PI / 2; // point forward
            arrowGroup.add(cone);

            const cylinder = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16),
                arrowMaterial
            );
            cylinder.position.set(0, 0.35, -0.5 * i);
            cylinder.rotation.x = -Math.PI / 2;
            arrowGroup.add(cylinder);
        });

        camera.add(arrowGroup);
        scene.add(camera);

        // Lighting
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 10, 10);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

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
