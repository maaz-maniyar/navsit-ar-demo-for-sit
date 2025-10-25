import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function ARView({ arrowStyle }) {
    const mountRef = useRef();
    const videoRef = useRef();
    const arrowGroupRef = useRef();
    const [userCoords, setUserCoords] = useState(null);

    useEffect(() => {
        let renderer, scene, camera, video, videoTexture;
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Scene setup
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 1.6, 0);

        // Renderer setup
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio * 0.9); // 🔹 smoother on high-DPI phones
        renderer.outputEncoding = THREE.sRGBEncoding;
        if (mountRef.current) mountRef.current.appendChild(renderer.domElement);

        // Video background (rear camera)
        video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("playsinline", "");
        video.style.display = "none";
        video.style.transform = "translateZ(0)"; // 🔹 GPU compositing hint
        video.style.willChange = "transform";    // 🔹 keeps video stable
        videoRef.current = video;

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" }, audio: false })
            .then((stream) => {
                video.srcObject = stream;
                video.play();

                // 🔹 FIXED: stable texture setup
                videoTexture = new THREE.VideoTexture(video);
                videoTexture.minFilter = THREE.LinearFilter;
                videoTexture.magFilter = THREE.LinearFilter;
                videoTexture.format = THREE.RGBFormat;
                videoTexture.generateMipmaps = false;   // ✅ stops flickering
                videoTexture.encoding = THREE.sRGBEncoding;
                videoTexture.needsUpdate = true;
                scene.background = videoTexture;
            })
            .catch((err) => console.error("Error accessing camera: ", err));

        // Arrow model
        const arrowGroup = new THREE.Group();
        arrowGroup.position.set(0, -0.5, -1);
        arrowGroupRef.current = arrowGroup;

        const cylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.25, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        cylinder.rotation.x = -Math.PI / 2;
        arrowGroup.add(cylinder);

        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.2, 16),
            new THREE.MeshStandardMaterial({ color: 0x000000 })
        );
        cone.position.set(0, 0, -0.225);
        cone.rotation.x = -Math.PI / 2;
        arrowGroup.add(cone);

        camera.add(arrowGroup);
        scene.add(camera);

        // Lighting
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 10, 10);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        // SIT Front Gate coords
        const targetLat = 13.331748;
        const targetLng = 77.127378;

        // Bearing calculator
        const computeBearing = (lat1, lng1, lat2, lng2) => {
            const φ1 = THREE.MathUtils.degToRad(lat1);
            const φ2 = THREE.MathUtils.degToRad(lat2);
            const λ1 = THREE.MathUtils.degToRad(lng1);
            const λ2 = THREE.MathUtils.degToRad(lng2);
            const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
            const x =
                Math.cos(φ1) * Math.sin(φ2) -
                Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
            let θ = Math.atan2(y, x);
            if (θ < 0) θ += 2 * Math.PI;
            return θ;
        };

        // GPS tracking
        const geoWatch = navigator.geolocation.watchPosition(
            (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.error(err),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );

        // Device orientation → compass heading
        let deviceHeading = 0;
        const handleOrientation = (event) => {
            let heading;
            if (typeof event.webkitCompassHeading !== "undefined") {
                heading = THREE.MathUtils.degToRad(event.webkitCompassHeading);
            } else {
                const alpha = THREE.MathUtils.degToRad(event.alpha || 0);
                const beta = THREE.MathUtils.degToRad(event.beta || 0);
                const gamma = THREE.MathUtils.degToRad(event.gamma || 0);

                const cA = Math.cos(alpha), sA = Math.sin(alpha);
                const cB = Math.cos(beta), sB = Math.sin(beta);
                const cG = Math.cos(gamma), sG = Math.sin(gamma);

                const Vx = -cA * sG - sA * sB * cG;
                const Vy = -sA * sG + cA * sB * cG;
                heading = Math.atan(Vx / Vy);
                if (Vy < 0) heading += Math.PI;
                else if (Vx < 0) heading += 2 * Math.PI;
            }
            deviceHeading = heading;
        };

        if (typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission().then((response) => {
                if (response === "granted") {
                    window.addEventListener("deviceorientation", handleOrientation, true);
                }
            });
        } else {
            window.addEventListener("deviceorientation", handleOrientation, true);
        }

        // Animation loop (with optional frame capping)
        let lastFrame = 0;
        const animate = (time) => {
            requestAnimationFrame(animate);
            if (time - lastFrame < 16) return; // ~60fps
            lastFrame = time;

            if (userCoords && arrowGroupRef.current) {
                const bearing = computeBearing(
                    userCoords.lat,
                    userCoords.lng,
                    targetLat,
                    targetLng
                );
                arrowGroupRef.current.rotation.y = bearing - deviceHeading;
            }

            // 🔹 Update only when a video frame is ready
            if (videoTexture && video.readyState >= video.HAVE_CURRENT_DATA) {
                videoTexture.needsUpdate = true;
            }

            renderer.render(scene, camera);
        };
        animate();

        // Cleanup
        return () => {
            if (mountRef.current && renderer) {
                mountRef.current.removeChild(renderer.domElement);
            }
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach((t) => t.stop());
            }
            navigator.geolocation.clearWatch(geoWatch);
            window.removeEventListener("deviceorientation", handleOrientation);
        };
    }, [arrowStyle, userCoords]);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default ARView;
