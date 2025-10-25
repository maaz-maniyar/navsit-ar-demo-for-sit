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
                const videoGeometry = new THREE.PlaneGeometry(10, 10 * (height / width));
                const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
                videoMesh.position.z = -5; // Behind arrows
                scene.add(videoMesh);
            })
            .catch((err) => {
                console.error("Error accessing camera: ", err);
            });

        // Arrows for path
        const scale = 0.1; // adjust for visible size in front of camera

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

        if (path.length > 1) {
            for (let i = 1; i < path.length; i++) {
                const [prevLat, prevLng] = path[i - 1];
                const [lat, lng] = path[i];

                const start = new THREE.Vector3(
                    (prevLng - path[0][1]) * scale,
                    0,
                    -(prevLat - path[0][0]) * scale - 2
                );
                const end = new THREE.Vector3(
                    (lng - path[0][1]) * scale,
                    0,
                    -(lat - path[0][0]) * scale - 2
                );

                createArrow(start, end);
            }
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
