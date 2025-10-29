import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BASE_URL } from "../config";

function ARView({ nextNodeCoords, path, onBack }) {
    const containerRef = useRef();
    const arrowRef = useRef();
    const sceneRef = useRef();
    const cameraRef = useRef();
    const rendererRef = useRef();
    const videoRef = useRef(null);
    const [status, setStatus] = useState("Initializing AR...");
    const userPosRef = useRef(null);
    const targetRef = useRef(nextNodeCoords || null);
    const updateIntervalRef = useRef(null);
    const rafRef = useRef(null);
    const arrivedRef = useRef(false);

    // helper: haversine distance (meters)
    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    useEffect(() => {
        // Create scene, camera, renderer
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        const camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, 1.6, 0);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        rendererRef.current = renderer;

        containerRef.current.appendChild(renderer.domElement);

        // optional: faint ground plane to help anchoring visually
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.02 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        scene.add(ground);

        // Lighting so GLB looks OK
        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
        scene.add(hemi);

        // Load GLB arrow
        const loader = new GLTFLoader();
        loader.load(
            "/models/RedArrow.glb",
            (gltf) => {
                const arrow = gltf.scene;
                arrow.traverse((c) => {
                    if (c.isMesh) {
                        c.castShadow = false;
                        c.receiveShadow = false;
                    }
                });

                // Size and orientation tuning — tweak scale if needed
                arrow.scale.set(0.8, 0.8, 0.8);
                // Place arrow at ground origin initially (we'll transform it to appear anchored)
                arrow.position.set(0, 0, -3); // 3m ahead (visual anchor)
                arrow.rotation.x = Math.PI / 2; // orient model if needed (adjust depending on your model)
                arrowRef.current = arrow;
                scene.add(arrow);
                setStatus("AR model loaded — waiting for GPS...");
            },
            undefined,
            (err) => {
                console.error("Failed to load GLB:", err);
                setStatus("Failed to load arrow model");
            }
        );

        // Render loop
        const animate = () => {
            rafRef.current = requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        // Cleanup
        const onResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", onResize);

        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener("resize", onResize);
            try {
                if (containerRef.current && renderer.domElement)
                    containerRef.current.removeChild(renderer.domElement);
            } catch (e) {}
        };
    }, []);

    // keep targetRef in sync with prop
    useEffect(() => {
        if (nextNodeCoords && nextNodeCoords.lat != null && nextNodeCoords.lng != null) {
            targetRef.current = { lat: nextNodeCoords.lat ?? nextNodeCoords.latitude, lng: nextNodeCoords.lng ?? nextNodeCoords.longitude };
            setStatus("Target set");
        }
    }, [nextNodeCoords]);

    // Start GPS + orientation + backend periodic updates
    useEffect(() => {
        if (!("geolocation" in navigator)) {
            setStatus("Geolocation not supported");
            return;
        }

        let deviceHeading = 0;
        let lastVibAt = 0;

        // orientation (fallback for browsers: deviceorientation -> compute heading approx)
        const orientationHandler = (e) => {
            // prefer webkitCompassHeading if available
            if (typeof e.webkitCompassHeading !== "undefined") {
                deviceHeading = THREE.MathUtils.degToRad(e.webkitCompassHeading);
            } else {
                const alpha = e.alpha ? THREE.MathUtils.degToRad(e.alpha) : 0;
                deviceHeading = alpha;
            }
            // recalc arrow on heading change
            rotateArrow(deviceHeading);
        };

        window.addEventListener("deviceorientation", orientationHandler, true);

        const geoWatchId = navigator.geolocation.watchPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                userPosRef.current = { lat, lng };

                // call backend update-node to get nextCoordinates/nextNode/remainingPath
                try {
                    if (BASE_URL) {
                        const resp = await fetch(`${BASE_URL}/api/chat/update-node`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ latitude: lat, longitude: lng })
                        });

                        if (resp.ok) {
                            const data = await resp.json();
                            // if backend gives nextCoordinates as array
                            if (data.nextCoordinates && Array.isArray(data.nextCoordinates)) {
                                targetRef.current = { lat: data.nextCoordinates[0], lng: data.nextCoordinates[1] };
                            } else if (data.nextNode) {
                                // try to fetch nodes map and resolve coordinates
                                try {
                                    const nodesResp = await fetch(`${BASE_URL}/api/nodes`);
                                    if (nodesResp.ok) {
                                        const nodes = await nodesResp.json();
                                        if (nodes[data.nextNode]) {
                                            targetRef.current = { lat: nodes[data.nextNode][0], lng: nodes[data.nextNode][1] };
                                        }
                                    }
                                } catch (e) {
                                    console.warn("Failed to fetch nodes:", e);
                                }
                            }
                            // update status message
                            if (data.reply) setStatus(data.reply);
                        }
                    }
                } catch (e) {
                    // backend call failed — keep local targetRef (if any)
                    // console.warn(e);
                }

                // rotate arrow using last known deviceHeading
                rotateArrow(deviceHeading);

                // arrival detection (stop camera & vibrate)
                if (targetRef.current) {
                    const dist = getDistance(lat, lng, targetRef.current.lat, targetRef.current.lng);
                    if (dist < 8 && !arrivedRef.current) {
                        arrivedRef.current = true;
                        setStatus("Arrived at destination");
                        if ("vibrate" in navigator) navigator.vibrate(170);
                        // stop camera tracks if any (we didn't open camera in this version, but keeping code)
                        try {
                            if (videoRef.current && videoRef.current.srcObject) {
                                videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
                                videoRef.current.srcObject = null;
                            }
                        } catch (e) {}
                    } else if (dist < 20) {
                        // vibrate briefly if approaching big turn changed recently (throttle)
                        const now = Date.now();
                        if (now - lastVibAt > 5000) {
                            // small nudge only if direction changed significantly — we don't compute bearing diff here for simplicity
                            // navigator.vibrate([60]); // optional
                            lastVibAt = now;
                        }
                    }
                }
            },
            (err) => {
                console.warn("Geolocation watch error:", err);
                setStatus("GPS error");
            },
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );

        // periodic server refresh (in case backend's activePaths updates)
        updateIntervalRef.current = setInterval(async () => {
            try {
                if (userPosRef.current && BASE_URL) {
                    const { lat, lng } = userPosRef.current;
                    const resp = await fetch(`${BASE_URL}/api/chat/update-node`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ latitude: lat, longitude: lng })
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data.nextCoordinates && Array.isArray(data.nextCoordinates)) {
                            targetRef.current = { lat: data.nextCoordinates[0], lng: data.nextCoordinates[1] };
                        }
                    }
                }
            } catch (e) {
                // ignore
            }
        }, 5000);

        // helper: compute bearing and rotate arrow
        function rotateArrow(deviceHeadingRad = 0) {
            const arrow = arrowRef.current;
            const user = userPosRef.current;
            const target = targetRef.current;
            if (!arrow || !user || !target) return;

            // compute bearing from user -> target (radians)
            const φ1 = (user.lat * Math.PI) / 180;
            const φ2 = (target.lat * Math.PI) / 180;
            const Δλ = ((target.lng - user.lng) * Math.PI) / 180;
            const y = Math.sin(Δλ) * Math.cos(φ2);
            const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
            let bearing = Math.atan2(y, x); // radians, -PI..PI
            if (bearing < 0) bearing += 2 * Math.PI; // 0..2PI

            // deviceHeadingRad is heading of device w.r.t north (radians)
            // We want arrow to point in camera space; compute relative angle:
            const relative = bearing - deviceHeadingRad;

            // Smooth rotation lerp
            const currentY = arrow.rotation.y || 0;
            const targetY = relative;
            // interpolation factor tuned for stable motion:
            const t = 0.25;
            arrow.rotation.y = THREE.MathUtils.lerp(currentY, targetY, t);

            // place arrow slightly ahead on ground so it appears anchored
            // set it a fixed distance in front of camera projected onto ground plane:
            const distVisual = 3; // meters
            // compute camera forward vector in world space
            const cam = cameraRef.current;
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
            // position = camera position + forward * distVisual, but set y to ground (0)
            const newPos = new THREE.Vector3().copy(cam.position).add(forward.multiplyScalar(distVisual));
            // keep arrow on ground
            newPos.y = 0;
            arrow.position.lerp(newPos, 0.25);
        }

        return () => {
            clearInterval(updateIntervalRef.current);
            navigator.geolocation.clearWatch(geoWatchId);
            window.removeEventListener("deviceorientation", orientationHandler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
            {/* AR canvas container */}
            <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

            {/* Back button */}
            <button
                onClick={() => {
                    // cleanup happens in effect cleanup; just call onBack
                    if (typeof onBack === "function") onBack();
                }}
                style={{
                    position: "absolute",
                    top: 18,
                    left: 18,
                    zIndex: 50,
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 14px",
                    cursor: "pointer",
                    boxShadow: "0 0 10px rgba(0,0,0,0.3)"
                }}
            >
                ← Back to Chat
            </button>

            {/* Status bar */}
            <div
                style={{
                    position: "absolute",
                    bottom: 18,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 50,
                    background: "rgba(0,0,0,0.4)",
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: 12,
                    fontWeight: 600
                }}
            >
                {status}
            </div>
        </div>
    );
}

export default ARView;
