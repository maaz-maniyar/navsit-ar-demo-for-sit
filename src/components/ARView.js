import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BACKEND_ORIGIN } from "../config";

const DEFAULT_OFFSET = -7;
const DEBUG_UPDATE_MS = 200;
const POSITION_UPDATE_MS = 3000;
const HEADING_SMOOTHING = 0.18;
const ARROW_SMOOTHING = 0.2;
const TURN_DEADBAND_DEG = 1.5;

const ARView = ({ onBack }) => {
    const containerRef = useRef(null);
    const arrowGroupRef = useRef(null);
    const bearingOffsetRef = useRef(DEFAULT_OFFSET);

    const [debug, setDebug] = useState({
        heading: 0,
        bearing: 0,
        relative: 0,
        nextNode: "",
        offset: DEFAULT_OFFSET,
    });

    useEffect(() => {
        const saved = localStorage.getItem("arrowOffset");
        if (saved) {
            const parsed = parseFloat(saved);
            if (Number.isFinite(parsed)) {
                bearingOffsetRef.current = parsed;
                setDebug((current) => ({ ...current, offset: parsed }));
            }
        }
    }, []);

    useEffect(() => {
        let scene;
        let camera;
        let renderer;
        let watchId;
        let animationFrameId;
        let lastDebugUpdate = 0;
        const loader = new GLTFLoader();
        const orientationListeners = [];
        const deviceHeadingRef = { current: null };
        const smoothedHeadingRef = { current: null };
        const targetBearingRef = { current: 0 };
        const targetCoordsRef = { current: null };
        const lastUpdateTimeRef = { current: 0 };

        const normalizeDegrees = (value) => ((value % 360) + 360) % 360;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const shortestAngleDelta = (fromDeg, toDeg) => ((toDeg - fromDeg + 540) % 360) - 180;
        const smoothAngle = (currentDeg, targetDeg, factor) =>
            normalizeDegrees(currentDeg + shortestAngleDelta(currentDeg, targetDeg) * factor);

        const calculateBearing = (lat1, lon1, lat2, lon2) => {
            const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
            const x =
                Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                Math.sin(toRad(lat1)) *
                    Math.cos(toRad(lat2)) *
                    Math.cos(toRad(lon2 - lon1));
            const bearing = Math.atan2(y, x);
            return normalizeDegrees((bearing * 180) / Math.PI);
        };

        const getScreenAngle = () => {
            if (window.screen?.orientation && typeof window.screen.orientation.angle === "number") {
                return window.screen.orientation.angle;
            }
            if (typeof window.orientation === "number") {
                return window.orientation;
            }
            return 0;
        };

        const getHeading = (event) => {
            if (typeof event.webkitCompassHeading === "number") {
                if (
                    typeof event.webkitCompassAccuracy === "number" &&
                    event.webkitCompassAccuracy >= 0 &&
                    event.webkitCompassAccuracy > 35
                ) {
                    return null;
                }
                return normalizeDegrees(event.webkitCompassHeading);
            }

            if (event.alpha === null) {
                return null;
            }

            return normalizeDegrees(360 - event.alpha + getScreenAngle());
        };

        const updateTargetBearing = (latitude, longitude) => {
            const targetCoords = targetCoordsRef.current;
            if (!targetCoords) {
                return;
            }

            targetBearingRef.current = calculateBearing(
                latitude,
                longitude,
                targetCoords.lat,
                targetCoords.lon
            );
        };

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1.6, 0);

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        directionalLight.position.set(0, 5, 5);
        scene.add(directionalLight);

        const arrowGroup = new THREE.Group();
        arrowGroup.position.set(0, 0, -3);
        scene.add(arrowGroup);
        arrowGroupRef.current = arrowGroup;

        loader.load(
            "/RedArrow.glb",
            (gltf) => {
                const arrow = gltf.scene;
                arrow.scale.set(0.4, 0.4, 0.4);
                arrow.rotation.x = -Math.PI / 4;
                arrow.position.set(0, -0.5, 0);
                arrowGroup.add(arrow);
            },
            undefined,
            (error) => console.error("Error loading arrow:", error)
        );

        const video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("playsinline", "");
        Object.assign(video.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            objectFit: "cover",
            zIndex: "-1",
        });
        document.body.appendChild(video);

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then((stream) => {
                video.srcObject = stream;
            })
            .catch((error) => console.error("Camera error:", error));

        const orientationHandler = (event) => {
            const heading = getHeading(event);
            if (!Number.isFinite(heading)) {
                return;
            }

            deviceHeadingRef.current = heading;
            if (smoothedHeadingRef.current === null) {
                smoothedHeadingRef.current = heading;
            }
        };

        ["deviceorientationabsolute", "deviceorientation"].forEach((eventName) => {
            window.addEventListener(eventName, orientationHandler, true);
            orientationListeners.push(eventName);
        });

        const fetchNextNode = async (latitude, longitude) => {
            try {
                const response = await fetch(`${BACKEND_ORIGIN}/api/chat/update-node`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ latitude, longitude }),
                });
                const data = await response.json();

                if (data?.nextCoordinates) {
                    targetCoordsRef.current = {
                        lat: data.nextCoordinates[0],
                        lon: data.nextCoordinates[1],
                    };
                    updateTargetBearing(latitude, longitude);
                    setDebug((current) => ({ ...current, nextNode: data.nextNode || "Unknown" }));
                }
            } catch (error) {
                console.error("Update-node error:", error);
            }
        };

        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    updateTargetBearing(latitude, longitude);

                    const now = Date.now();
                    if (now - lastUpdateTimeRef.current > POSITION_UPDATE_MS) {
                        lastUpdateTimeRef.current = now;
                        fetchNextNode(latitude, longitude);
                    }
                },
                (error) => console.error("GPS error:", error),
                { enableHighAccuracy: true }
            );
        }

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);

            if (arrowGroupRef.current && deviceHeadingRef.current !== null) {
                smoothedHeadingRef.current =
                    smoothedHeadingRef.current === null
                        ? deviceHeadingRef.current
                        : smoothAngle(
                              smoothedHeadingRef.current,
                              deviceHeadingRef.current,
                              HEADING_SMOOTHING
                          );

                const offset = bearingOffsetRef.current;
                const heading = smoothedHeadingRef.current;
                const relative = normalizeDegrees(targetBearingRef.current - heading + offset);
                const currentY = THREE.MathUtils.radToDeg(arrowGroupRef.current.rotation.y);
                const delta = shortestAngleDelta(currentY, relative);
                const appliedDelta = Math.abs(delta) < TURN_DEADBAND_DEG ? 0 : delta * ARROW_SMOOTHING;
                arrowGroupRef.current.rotation.y = THREE.MathUtils.degToRad(currentY + appliedDelta);

                const now = Date.now();
                if (now - lastDebugUpdate >= DEBUG_UPDATE_MS) {
                    lastDebugUpdate = now;
                    setDebug((current) => ({
                        ...current,
                        heading: heading.toFixed(1),
                        bearing: targetBearingRef.current.toFixed(1),
                        relative: relative.toFixed(1),
                        offset: offset.toFixed(1),
                    }));
                }
            }

            renderer.render(scene, camera);
        };

        animate();

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
            }
            orientationListeners.forEach((eventName) => {
                window.removeEventListener(eventName, orientationHandler, true);
            });
            if (renderer) {
                renderer.dispose();
            }
            document.querySelectorAll("video").forEach((element) => element.remove());
        };
    }, []);

    const handleOffsetChange = (value) => {
        bearingOffsetRef.current = value;
        localStorage.setItem("arrowOffset", value);
        setDebug((current) => ({ ...current, offset: value }));
    };

    return (
        <>
            <div
                ref={containerRef}
                style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
            />

            <button
                onClick={onBack}
                style={{
                    position: "absolute",
                    top: 20,
                    left: 20,
                    zIndex: 10,
                    background: "rgba(0,0,0,0.5)",
                    color: "white",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                }}
            >
                Return to Chat
            </button>

            <div
                style={{
                    position: "absolute",
                    bottom: 90,
                    left: 20,
                    zIndex: 10,
                    background: "rgba(0,0,0,0.5)",
                    color: "#0f0",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontFamily: "monospace",
                    fontSize: "14px",
                }}
            >
                <div>Heading: {debug.heading}°</div>
                <div>Bearing: {debug.bearing}°</div>
                <div>Relative: {debug.relative}°</div>
                <div>Next: {debug.nextNode}</div>
                <div>Offset: {debug.offset}°</div>
            </div>

            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "80%",
                    zIndex: 10,
                    textAlign: "center",
                    color: "white",
                }}
            >
                <label>Adjust Arrow Offset ({debug.offset}°)</label>
                <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={debug.offset}
                    onChange={(event) => handleOffsetChange(parseFloat(event.target.value))}
                    style={{
                        width: "100%",
                        marginTop: "8px",
                        accentColor: "#4CAF50",
                    }}
                />
            </div>
        </>
    );
};

export default ARView;
