import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function ARView({ arrowStyle }) {
    const mountRef = useRef();
    const videoRef = useRef();
    const arrowGroupRef = useRef();
    const [userCoords, setUserCoords] = useState(null); // User GPS

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

                videoTexture = new THREE.VideoTexture(video);
                videoTexture.minFilter = THREE.LinearFilter;
                videoTexture.magFilter = THREE.LinearFilter;
                videoTexture.format = THREE.RGBFormat;

                scene.background = videoTexture;
            })
            .catch((err) => console.error("Error accessing camera: ", err));

        // Arrow group (cone + cylinder together)
        const arrowGroup = new THREE.Group();
        arrowGroup.position.set(0, -0.5, -1); // Place in front & bottom
        arrowGroupRef.current = arrowGroup;

        // Cylinder (stem) → white
        const cylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.25, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        cylinder.position.set(0, 0, 0); // relative to group origin
        cylinder.rotation.x = -Math.PI / 2;
        arrowGroup.add(cylinder);

        // Cone (tip) → black
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.2, 16),
            new THREE.MeshStandardMaterial({ color: 0x000000 })
        );
        cone.position.set(0, 0, -0.225); // tip in front of cylinder
        cone.rotation.x = -Math.PI / 2;
        arrowGroup.add(cone);

        camera.add(arrowGroup);
        scene.add(camera);

        // Lighting
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 10, 10);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        // SIT Front Gate coordinates
        const targetLat = 13.331748;
        const targetLng = 77.127378;

        // Compute bearing helper
        const computeBearing = (lat1, lng1, lat2, lng2) => {
            const φ1 = THREE.MathUtils.degToRad(lat1);
            const φ2 = THREE.MathUtils.degToRad(lat2);
            const λ1 = THREE.MathUtils.degToRad(lng1);
            const λ2 = THREE.MathUtils.degToRad(lng2);

            const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
            const x =
                Math.cos(φ1) * Math.sin(φ2) -
                Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
            const θ = Math.atan2(y, x);
            return θ; // radians
        };

        // Update user's GPS
        const geoWatch = navigator.geolocation.watchPosition(
            (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.error(err),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );

        // Device orientation (rotation around Y axis)
        let deviceAlpha = 0;
        const handleOrientation = (e) => {
            deviceAlpha = THREE.MathUtils.degToRad(e.alpha || 0);
        };
        window.addEventListener("deviceorientation", handleOrientation, true);

        // Animate
        const animate = () => {
            requestAnimationFrame(animate);

            // Rotate arrow if we have user coordinates
            if (userCoords && arrowGroupRef.current) {
                const bearing = computeBearing(
                    userCoords.lat,
                    userCoords.lng,
                    targetLat,
                    targetLng
                );
                // Rotate the arrow: device heading + bearing to target
                arrowGroupRef.current.rotation.y = -deviceAlpha + bearing;
            }

            // Update video texture if available
            if (videoTexture) videoTexture.needsUpdate = true;

            renderer.render(scene, camera);
        };
        animate();

        // Cleanup
        return () => {
            if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach((track) => track.stop());
            }
            navigator.geolocation.clearWatch(geoWatch);
            window.removeEventListener("deviceorientation", handleOrientation);
        };
    }, [arrowStyle, userCoords]);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default ARView;
