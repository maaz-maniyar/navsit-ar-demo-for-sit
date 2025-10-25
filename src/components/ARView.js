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
        camera.position.set(0, 1.6, 2);

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
                videoMesh.position.z = -1;
                scene.add(videoMesh);
            })
            .catch((err) => console.error("Error accessing camera: ", err));

        // Function to create 3D arrow between two points
        const createArrow = (start, end, color = 0xff0000) => {
            const dir = new THREE.Vector3().subVectors(end, start);
            const length = dir.length();
            dir.normalize();

            // Shaft
            const shaftGeom = new THREE.CylinderGeometry(0.02, 0.02, length * 0.8, 8);
            const shaftMat = new THREE.MeshBasicMaterial({ color });
            const shaft = new THREE.Mesh(shaftGeom, shaftMat);

            shaft.position.copy(start.clone().add(dir.clone().multiplyScalar(length * 0.4)));
            shaft.lookAt(end);

            // Arrowhead
            const headGeom = new THREE.ConeGeometry(0.05, length * 0.2, 8);
            const headMat = new THREE.MeshBasicMaterial({ color });
            const head = new THREE.Mesh(headGeom, headMat);
            head.position.copy(start.clone().add(dir.clone().multiplyScalar(length * 0.9)));
            head.lookAt(end);

            scene.add(shaft);
            scene.add(head);
        };

        // Add arrows for path
        if (path.length > 0) {
            const refLat = path[0][0];
            const refLng = path[0][1];
            const scale = 1000;

            for (let i = 1; i < path.length; i++) {
                const [prevLat, prevLng] = path[i - 1];
                const [lat, lng] = path[i];

                const start = new THREE.Vector3((prevLng - refLng) * scale, 0, (prevLat - refLat) * scale);
                const end = new THREE.Vector3((lng - refLng) * scale, 0, (lat - refLat) * scale);

                createArrow(start, end);
            }
        }

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
