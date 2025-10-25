import React, { useEffect, useRef } from "react";
import * as THREE from "three";

function ARView({ path, arrowStyle }) {
    const mountRef = useRef();
    const videoRef = useRef();

    useEffect(() => {
        let renderer, scene, camera, video, videoTexture, arrowGroup;

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

        // Arrow group (cone first, then cylinder)
        arrowGroup = new THREE.Group();

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
        cylinder.position.set(0, (arrowStyle?.y || -0.5) - 0.125, arrowStyle?.z || -1);
        cylinder.rotation.x = -Math.PI / 2; // point forward
        arrowGroup.add(cylinder);

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

            // --- Arrow direction update ---
            if (path && path.length > 1) {
                const start = path[0]; // current node
                const end = path[1];   // next node
                const dir = new THREE.Vector3(end.lng - start.lng, 0, end.lat - start.lat).normalize();

                // Point the arrowGroup toward the next node
                const arrowPos = new THREE.Vector3(0, arrowStyle?.y || -0.5, arrowStyle?.z || -1);
                arrowGroup.lookAt(arrowPos.clone().add(dir));
            }

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
    }, [path, arrowStyle]);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default ARView;
