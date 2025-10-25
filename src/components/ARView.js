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
        camera.position.set(0, 1.6, 3); // Pull camera back a bit to see arrows

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

                // Use video as background texture
                videoTexture = new THREE.VideoTexture(video);
                const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
                const videoGeometry = new THREE.PlaneGeometry(2, 2);
                const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);

                // Scale to fill screen
                videoMesh.scale.set(width / height, 1, 1);
                videoMesh.position.set(0, 0, -5); // Push it behind arrows
                scene.add(videoMesh);
            })
            .catch((err) => {
                console.error("Error accessing camera: ", err);
            });

        // Base coordinates for scaling
        const baseLat = path.length > 0 ? path[0][0] : 0;
        const baseLng = path.length > 0 ? path[0][1] : 0;
        const SCALE = 50; // Adjust scale for visibility

        // Add 3D arrows along path
        const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const arrowGroup = new THREE.Group();

        for (let i = 1; i < path.length; i++) {
            const [prevLat, prevLng] = path[i - 1];
            const [lat, lng] = path[i];

            const x1 = (prevLng - baseLng) * SCALE;
            const z1 = (prevLat - baseLat) * SCALE;
            const x2 = (lng - baseLng) * SCALE;
            const z2 = (lat - baseLat) * SCALE;

            const start = new THREE.Vector3(x1, -0.5, z1); // y = -0.5 for bottom
            const end = new THREE.Vector3(x2, -0.5, z2);
            const dir = new THREE.Vector3().subVectors(end, start);
            const length = dir.length();

            // Arrow head
            const coneGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
            const cone = new THREE.Mesh(coneGeometry, arrowMaterial);
            cone.position.copy(start.clone().add(dir.clone().multiplyScalar(0.9)));
            cone.lookAt(end);
            arrowGroup.add(cone);

            // Arrow shaft
            const cylinderGeometry = new THREE.CylinderGeometry(0.05, 0.05, length * 0.9, 8);
            const cylinder = new THREE.Mesh(cylinderGeometry, arrowMaterial);
            cylinder.position.copy(start.clone().add(dir.clone().multiplyScalar(0.45)));
            cylinder.lookAt(end);
            cylinder.rotateX(Math.PI / 2);
            arrowGroup.add(cylinder);
        }

        scene.add(arrowGroup);

        // Lighting for better visibility
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 10, 10);
        scene.add(light);
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

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
