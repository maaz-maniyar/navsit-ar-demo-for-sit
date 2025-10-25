import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function ARView() {
    const mountRef = useRef();
    const videoRef = useRef();
    const [deviceHeading, setDeviceHeading] = useState(0);
    const [userCoords, setUserCoords] = useState({ lat: null, lng: null });

    // Target: SIT Front Gate
    const targetCoords = { lat: 13.331748, lng: 77.127378 };

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

        // Video feed
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

        // Arrow group (cone + cylinder)
        const arrowGroup = new THREE.Group();

        // Cone (tip) → black
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.2, 16),
            new THREE.MeshStandardMaterial({ color: 0x000000 })
        );
        cone.position.set(0, 0.1, 0); // local position inside arrow group
        cone.rotation.x = -Math.PI / 2;
        arrowGroup.add(cone);

        // Cylinder (stem) → white
        const cylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.25, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        cylinder.position.set(0, -0.125, 0); // behind the cone
        cylinder.rotation.x = -Math.PI / 2;
        arrowGroup.add(cylinder);

        // Position arrow 1 meter in front of camera
        arrowGroup.position.set(0, -0.5, -1);
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

            // Update arrow rotation based on GPS bearing
            if (userCoords.lat && userCoords.lng) {
                const bearing = getBearing(userCoords.lat, userCoords.lng, targetCoords.lat, targetCoords.lng);
                arrowGroup.rotation.y = -THREE.MathUtils.degToRad(deviceHeading) + THREE.MathUtils.degToRad(bearing);
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
    }, [deviceHeading, userCoords]);

    // Device orientation listener
    useEffect(() => {
        const handleOrientation = (event) => {
            if (event.alpha !== null) {
                setDeviceHeading(event.alpha); // degrees
            }
        };
        window.addEventListener("deviceorientationabsolute", handleOrientation, true);
        return () => window.removeEventListener("deviceorientationabsolute", handleOrientation);
    }, []);

    // GPS listener
    useEffect(() => {
        const watchId = navigator.geolocation.watchPosition(
            (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.error(err),
            { enableHighAccuracy: true, maximumAge: 1000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Helper: compute bearing from user to target
    const getBearing = (lat1, lon1, lat2, lon2) => {
        const φ1 = THREE.MathUtils.degToRad(lat1);
        const φ2 = THREE.MathUtils.degToRad(lat2);
        const Δλ = THREE.MathUtils.degToRad(lon2 - lon1);
        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        const θ = Math.atan2(y, x);
        return (THREE.MathUtils.radToDeg(θ) + 360) % 360;
    };

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default ARView;
