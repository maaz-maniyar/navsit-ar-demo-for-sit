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
        camera.position.set(0, 1.6, 2); // slightly back so arrows are visible

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

                // Use video as background texture
                videoTexture = new THREE.VideoTexture(video);
                const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
                const videoGeometry = new THREE.PlaneGeometry(2, 2);
                const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
                videoMesh.position.z = -1; // behind arrows
                scene.add(videoMesh);
            })
            .catch((err) => {
                console.error("Error accessing camera: ", err);
            });

        // Arrows for path
        if (path.length > 0) {
            const refLat = path[0][0];
            const refLng = path[0][1];
            const scale = 1000; // Adjust to fit arrows in view

            path.forEach(([lat, lng], index) => {
                if (index === 0) return;
                const [prevLat, prevLng] = path[index - 1];

                const startX = (prevLng - refLng) * scale;
                const startZ = (prevLat - refLat) * scale;
                const endX = (lng - refLng) * scale;
                const endZ = (lat - refLat) * scale;

                const dir = new THREE.Vector3(endX - startX, 0, endZ - startZ);
                const length = dir.length();

                const arrow = new THREE.ArrowHelper(
                    dir.clone().normalize(),
                    new THREE.Vector3(startX, 0, startZ),
                    length,
                    0xff0000
                );
                scene.add(arrow);
            });
        }

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
