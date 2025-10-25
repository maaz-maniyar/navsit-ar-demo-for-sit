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
        camera.position.set(0, 1.6, 1); // position slightly forward

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.domElement.style.position = "absolute";
        renderer.domElement.style.top = "0";
        renderer.domElement.style.left = "0";
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
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

                // Use video as background using a fullscreen plane in front of camera
                videoTexture = new THREE.VideoTexture(video);
                const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
                const videoGeometry = new THREE.PlaneGeometry(2, 2 * (height / width));
                const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
                videoMesh.position.set(0, 0, -2); // always behind arrows
                scene.add(videoMesh);
            })
            .catch((err) => console.error("Error accessing camera: ", err));

        // 3D Arrows for path
        path.forEach(([lat, lng], index) => {
            if (index === 0) return;
            const [prevLat, prevLng] = path[index - 1];
            const dir = new THREE.Vector3(lng - prevLng, 0, lat - prevLat);
            const length = dir.length();
            const normalizedDir = dir.clone().normalize();

            // Arrow components
            const shaft = new THREE.Mesh(
                new THREE.CylinderGeometry(0.01, 0.01, length * 0.8, 8),
                new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            shaft.position.y = 0.05;
            shaft.rotation.z = Math.atan2(normalizedDir.x, normalizedDir.z);

            const head = new THREE.Mesh(
                new THREE.ConeGeometry(0.03, length * 0.2, 8),
                new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            head.position.y = 0.05;
            head.position.z = length * 0.5;
            head.rotation.z = Math.atan2(normalizedDir.x, normalizedDir.z);

            const arrowGroup = new THREE.Group();
            arrowGroup.add(shaft);
            arrowGroup.add(head);
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
            if (video && video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
        };
    }, [path]);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh", overflow: "hidden" }} />;
}

export default ARView;
