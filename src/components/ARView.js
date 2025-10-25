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

        // Video feed
        video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("playsinline", "");
        videoRef.current = video;

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" }, audio: false })
            .then((stream) => {
                video.srcObject = stream;
                video.play();

                videoTexture = new THREE.VideoTexture(video);
                videoTexture.minFilter = THREE.LinearFilter;
                videoTexture.magFilter = THREE.LinearFilter;
                videoTexture.format = THREE.RGBFormat;

                const aspect = width / height;
                const videoHeight = 2;
                const videoWidth = videoHeight * aspect;

                const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
                const videoGeometry = new THREE.PlaneGeometry(videoWidth, videoHeight);
                const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
                videoMesh.position.set(0, 0, -5);
                scene.add(videoMesh);
            })
            .catch((err) => console.error("Error accessing camera: ", err));

        // Helper: create 3D arrow
        const createArrow = (start, end, color = 0xff0000) => {
            const dir = new THREE.Vector3().subVectors(end, start);
            const length = dir.length();
            dir.normalize();

            const arrowGroup = new THREE.Group();

            // Shaft
            const shaftGeom = new THREE.CylinderGeometry(0.02, 0.02, length * 0.8, 12);
            const shaftMat = new THREE.MeshBasicMaterial({ color });
            const shaft = new THREE.Mesh(shaftGeom, shaftMat);
            shaft.position.set(0, length * 0.4, 0);
            shaft.rotation.x = Math.PI / 2;
            arrowGroup.add(shaft);

            // Head
            const headGeom = new THREE.ConeGeometry(0.05, length * 0.2, 12);
            const headMat = new THREE.MeshBasicMaterial({ color });
            const head = new THREE.Mesh(headGeom, headMat);
            head.position.set(0, length * 0.9, 0);
            head.rotation.x = Math.PI / 2;
            arrowGroup.add(head);

            // Orient group
            arrowGroup.position.copy(start);
            arrowGroup.lookAt(end);

            scene.add(arrowGroup);
        };

        // Add arrows along path (scaled to relative positions)
        if (path.length > 1) {
            const scale = 1; // adjust to fit in front of camera
            for (let i = 1; i < path.length; i++) {
                const [prevLat, prevLng] = path[i - 1];
                const [lat, lng] = path[i];

                const start = new THREE.Vector3((prevLng - path[0][1]) * scale, 0, -(prevLat - path[0][0]) * scale);
                const end = new THREE.Vector3((lng - path[0][1]) * scale, 0, -(lat - path[0][0]) * scale);

                createArrow(start, end);
            }
        }

        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

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
