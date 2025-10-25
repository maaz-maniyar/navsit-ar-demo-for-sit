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

                // Use video as background texture
                videoTexture = new THREE.VideoTexture(video);
                const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
                const videoGeometry = new THREE.PlaneGeometry(2, 2);
                const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
                videoMesh.position.z = -1; // Behind arrows
                scene.add(videoMesh);
            })
            .catch((err) => {
                console.error("Error accessing camera: ", err);
            });

        // Create arrows along the path
        path.forEach(([lat, lng], index) => {
            if (index === 0) return;
            const [prevLat, prevLng] = path[index - 1];
            const dir = new THREE.Vector3(lng - prevLng, 0, lat - prevLat);
            const length = dir.length();

            // Cylinder (shaft)
            const shaftGeometry = new THREE.CylinderGeometry(0.02, 0.02, length, 8);
            const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); // White
            const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
            shaft.position.set(
                (prevLng + lng) / 2,
                0.1,
                (prevLat + lat) / 2
            );
            shaft.lookAt(new THREE.Vector3(lng, 0.1, lat));
            shaft.rotateX(Math.PI / 2);
            scene.add(shaft);

            // Cone (tip)
            const coneGeometry = new THREE.ConeGeometry(0.05, 0.1, 8);
            const coneMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Black
            const cone = new THREE.Mesh(coneGeometry, coneMaterial);
            cone.position.set(lng, 0.1, lat);
            cone.lookAt(new THREE.Vector3(prevLng, 0.1, prevLat));
            cone.rotateX(Math.PI / 2);
            scene.add(cone);
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
