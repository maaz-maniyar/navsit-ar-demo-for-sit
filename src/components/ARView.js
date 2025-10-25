import React, { useEffect, useRef } from "react";
import * as THREE from "three";

function ARView({ path }) {
    const mountRef = useRef(null);

    useEffect(() => {
        if (!navigator.xr) {
            alert("WebXR not supported on this device/browser");
            return;
        }

        let scene, camera, renderer, reticle;
        let arrowMeshes = [];

        const init = async () => {
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(
                70,
                window.innerWidth / window.innerHeight,
                0.01,
                20
            );

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.xr.enabled = true;

            mountRef.current.appendChild(renderer.domElement);

            // Add light
            const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
            scene.add(light);

            // Create arrow markers
            const arrowGeometry = new THREE.ConeGeometry(0.05, 0.15, 8);
            const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });

            path.forEach((pos) => {
                const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
                arrow.position.set(pos[0], 0, pos[1]); // x, y, z
                arrow.rotation.x = -Math.PI / 2; // point downwards
                scene.add(arrow);
                arrowMeshes.push(arrow);
            });

            // Start AR session
            const session = await navigator.xr.requestSession("immersive-ar", {
                requiredFeatures: ["local-floor"],
            });
            renderer.xr.setSession(session);

            renderer.setAnimationLoop(() => {
                renderer.render(scene, camera);
            });
        };

        init();

        return () => {
            renderer?.setAnimationLoop(null);
            if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
        };
    }, [path]);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default ARView;
