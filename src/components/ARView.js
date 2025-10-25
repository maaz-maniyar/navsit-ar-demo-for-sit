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

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(0, 1, 1);
        scene.add(directionalLight);

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
                videoTexture.minFilter = THREE.LinearFilter;
                videoTexture.magFilter = THREE.LinearFilter;
                videoTexture.format = THREE.RGBFormat;

                const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
                const videoGeometry = new THREE.PlaneGeometry(2, 2);
                const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
                videoMesh.position.z = -1; // behind arrows
                scene.add(videoMesh);
            })
            .catch((err) => {
                console.error("Error accessing camera: ", err);
            });

        // Function to create 3D arrow
        const createArrow3D = (from, to, color = 0xff0000) => {
            const dir = new THREE.Vector3(to[1] - from[1], 0, to[0] - from[0]);
            const length = dir.length();

            const arrowGroup = new THREE.Group();

            // Shaft
            const shaftGeo = new THREE.CylinderGeometry(0.03, 0.03, length * 0.8, 12);
            const shaftMat = new THREE.MeshStandardMaterial({ color });
            const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
            shaftMesh.position.y = length * 0.4;
            arrowGroup.add(shaftMesh);

            // Head
            const headGeo = new THREE.ConeGeometry(0.06, length * 0.2, 12);
            const headMat = new THREE.MeshStandardMaterial({ color });
            const headMesh = new THREE.Mesh(headGeo, headMat);
            headMesh.position.y = length * 0.9;
            arrowGroup.add(headMesh);

            // Orient arrow along path
            const axis = new THREE.Vector3(0, 1, 0); // default up
            arrowGroup.quaternion.setFromUnitVectors(axis, dir.clone().normalize());

            // Position arrow in front of camera, lower part of feed
            arrowGroup.position.set(0, -0.5, -0.5);

            scene.add(arrowGroup);
        };

        // Render arrows along path
        path.forEach((point, i) => {
            if (i === 0) return;
            createArrow3D(path[i - 1], point);
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
