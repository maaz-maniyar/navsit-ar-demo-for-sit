import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BACKEND_ORIGIN } from "../config";

const DEBUG_UPDATE_MS = 200;
const POSITION_UPDATE_MS = 3000;
const HEADING_SMOOTHING = 0.18;
const ARROW_SMOOTHING = 0.2;
const TURN_DEADBAND_DEG = 1.5;
const ARROW_MODEL_YAW_CORRECTION_DEG = -7;
const WORLD_ARROW_DISTANCE_METERS = 3;

const ARView = ({ onBack }) => {
    const containerRef = useRef(null);
    const arrowGroupRef = useRef(null);
    const startWorldArRef = useRef(null);
    const stopWorldArRef = useRef(null);
    const xrAvailableRef = useRef(false);
    const [xrAvailable, setXrAvailable] = useState(false);
    const [arMode, setArMode] = useState("overlay");
    const [arStatus, setArStatus] = useState("Checking world AR support...");

    const [debug, setDebug] = useState({
        heading: 0,
        bearing: 0,
        relative: 0,
        nextNode: "",
    });

    useEffect(() => {
        let scene;
        let camera;
        let renderer;
        let watchId;
        let lastDebugUpdate = 0;
        let videoElement = null;
        let mediaStream = null;
        let xrSession = null;
        const loader = new GLTFLoader();
        const orientationListeners = [];
        const deviceHeadingRef = { current: null };
        const smoothedHeadingRef = { current: null };
        const headingSourceRef = { current: null };
        const targetBearingRef = { current: 0 };
        const targetCoordsRef = { current: null };
        const lastUpdateTimeRef = { current: 0 };
        const arModeRef = { current: "overlay" };
        const upAxis = new THREE.Vector3(0, 1, 0);
        const tempForward = new THREE.Vector3();
        const tempTargetDirection = new THREE.Vector3();
        const tempTargetPosition = new THREE.Vector3();

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

        const computeCompassHeading = (alpha, beta, gamma) => {
            if (alpha === null || beta === null || gamma === null) {
                return null;
            }

            const alphaRad = toRad(alpha);
            const betaRad = toRad(beta);
            const gammaRad = toRad(gamma);

            const cAlpha = Math.cos(alphaRad);
            const sAlpha = Math.sin(alphaRad);
            const sBeta = Math.sin(betaRad);
            const cGamma = Math.cos(gammaRad);
            const sGamma = Math.sin(gammaRad);

            const rA = -cAlpha * sGamma - sAlpha * sBeta * cGamma;
            const rB = -sAlpha * sGamma + cAlpha * sBeta * cGamma;

            let heading = Math.atan2(rA, rB);
            if (rB < 0) {
                heading += Math.PI;
            } else if (rA < 0) {
                heading += 2 * Math.PI;
            }

            return normalizeDegrees((heading * 180) / Math.PI);
        };

        const getHeadingData = (event) => {
            if (typeof event.webkitCompassHeading === "number") {
                if (
                    typeof event.webkitCompassAccuracy === "number" &&
                    event.webkitCompassAccuracy >= 0 &&
                    event.webkitCompassAccuracy > 35
                ) {
                    return null;
                }
                return {
                    heading: normalizeDegrees(event.webkitCompassHeading),
                    source: "webkitCompassHeading",
                };
            }

            const compassHeading = computeCompassHeading(event.alpha, event.beta, event.gamma);
            if (!Number.isFinite(compassHeading)) {
                return null;
            }

            return {
                heading: normalizeDegrees(compassHeading + getScreenAngle()),
                source: event.type === "deviceorientationabsolute" ? "deviceorientationabsolute" : "deviceorientation",
            };
        };

        const getSourcePriority = (source) => {
            switch (source) {
                case "webkitCompassHeading":
                    return 3;
                case "deviceorientationabsolute":
                    return 2;
                case "deviceorientation":
                    return 1;
                default:
                    return 0;
            }
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

        const stopFallbackVideo = () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach((track) => track.stop());
                mediaStream = null;
            }

            if (videoElement) {
                videoElement.remove();
                videoElement = null;
            }
        };

        const ensureFallbackVideo = async () => {
            if (arModeRef.current === "webxr" || videoElement) {
                return;
            }

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

            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" },
                });
                video.srcObject = mediaStream;
                document.body.appendChild(video);
                videoElement = video;
                setArStatus((current) =>
                    current === "World AR active"
                        ? current
                        : xrAvailableRef.current
                          ? "World AR ready. Use Enter World AR for anchored mode."
                          : "Using free compass fallback. World AR not supported on this device/browser."
                );
            } catch (error) {
                console.error("Camera error:", error);
                setArStatus("Camera access failed. AR guidance may be limited.");
            }
        };

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1.6, 0);

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.xr.enabled = true;
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
                arrow.rotation.y = THREE.MathUtils.degToRad(ARROW_MODEL_YAW_CORRECTION_DEG);
                arrow.position.set(0, -0.5, 0);
                arrowGroup.add(arrow);
            },
            undefined,
            (error) => console.error("Error loading arrow:", error)
        );

        const orientationHandler = (event) => {
            const headingData = getHeadingData(event);
            if (!headingData || !Number.isFinite(headingData.heading)) {
                return;
            }

            const currentSource = headingSourceRef.current;
            if (
                currentSource &&
                getSourcePriority(headingData.source) < getSourcePriority(currentSource)
            ) {
                return;
            }

            if (currentSource !== headingData.source) {
                headingSourceRef.current = headingData.source;
                smoothedHeadingRef.current = headingData.heading;
            }

            deviceHeadingRef.current = headingData.heading;
            if (smoothedHeadingRef.current === null) {
                smoothedHeadingRef.current = headingData.heading;
            }
        };

        ["deviceorientationabsolute", "deviceorientation"].forEach((eventName) => {
            window.addEventListener(eventName, orientationHandler, true);
            orientationListeners.push(eventName);
        });

        const checkWorldArSupport = async () => {
            if (!navigator.xr?.isSessionSupported) {
                setXrAvailable(false);
                setArStatus("Using free compass fallback. WebXR AR is not available here.");
                await ensureFallbackVideo();
                return;
            }

            try {
                const supported = await navigator.xr.isSessionSupported("immersive-ar");
                xrAvailableRef.current = supported;
                setXrAvailable(supported);
                setArStatus(
                    supported
                        ? "World AR ready. Use Enter World AR for anchored mode."
                        : "Using free compass fallback. World AR is not supported on this device/browser."
                );
            } catch (error) {
                console.error("WebXR support check failed:", error);
                xrAvailableRef.current = false;
                setXrAvailable(false);
                setArStatus("Using free compass fallback. WebXR support check failed.");
            }

            await ensureFallbackVideo();
        };

        const endWorldArSession = async () => {
            if (!xrSession) {
                return;
            }

            const sessionToClose = xrSession;
            xrSession = null;
            try {
                await sessionToClose.end();
            } catch (error) {
                console.error("Failed to end WebXR session:", error);
            }
        };

        const startWorldArSession = async () => {
            if (!navigator.xr?.requestSession || !renderer) {
                setArStatus("World AR is not available. Staying on the free compass fallback.");
                return;
            }

            try {
                const sessionInit = {
                    requiredFeatures: ["local-floor"],
                    optionalFeatures: ["dom-overlay", "anchors", "hit-test"],
                };

                if (containerRef.current) {
                    sessionInit.domOverlay = { root: containerRef.current };
                }

                const session = await navigator.xr.requestSession("immersive-ar", sessionInit);

                xrSession = session;
                arModeRef.current = "webxr";
                setArMode("webxr");
                setArStatus("World AR active");
                stopFallbackVideo();

                session.addEventListener("end", async () => {
                    xrSession = null;
                    arModeRef.current = "overlay";
                    setArMode("overlay");
                    setArStatus(
                        xrAvailableRef.current
                            ? "World AR closed. Using free compass fallback."
                            : "Using free compass fallback."
                    );
                    await ensureFallbackVideo();
                });

                await renderer.xr.setSession(session);
            } catch (error) {
                console.error("Failed to start WebXR session:", error);
                setArStatus("World AR could not start. Using the free compass fallback instead.");
                arModeRef.current = "overlay";
                setArMode("overlay");
                await ensureFallbackVideo();
            }
        };

        startWorldArRef.current = startWorldArSession;
        stopWorldArRef.current = endWorldArSession;

        checkWorldArSupport();

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
            if (arrowGroupRef.current && deviceHeadingRef.current !== null) {
                smoothedHeadingRef.current =
                    smoothedHeadingRef.current === null
                        ? deviceHeadingRef.current
                        : smoothAngle(
                              smoothedHeadingRef.current,
                              deviceHeadingRef.current,
                              HEADING_SMOOTHING
                          );

                const heading = smoothedHeadingRef.current;
                const relativeDelta = shortestAngleDelta(heading, targetBearingRef.current);
                const relative = Math.abs(relativeDelta) < TURN_DEADBAND_DEG ? 0 : relativeDelta;

                if (arModeRef.current === "webxr" && renderer.xr.isPresenting) {
                    const xrCamera = renderer.xr.getCamera(camera);
                    xrCamera.getWorldDirection(tempForward);
                    tempForward.y = 0;

                    if (tempForward.lengthSq() > 0.0001) {
                        tempForward.normalize();
                        tempTargetDirection
                            .copy(tempForward)
                            .applyAxisAngle(upAxis, toRad(relative))
                            .normalize();

                        tempTargetPosition
                            .copy(xrCamera.position)
                            .addScaledVector(tempTargetDirection, WORLD_ARROW_DISTANCE_METERS);

                        arrowGroupRef.current.position.lerp(tempTargetPosition, ARROW_SMOOTHING);
                        arrowGroupRef.current.lookAt(
                            tempTargetPosition.clone().add(tempTargetDirection)
                        );
                    }
                } else {
                    arrowGroupRef.current.position.set(0, 0, -3);
                    const targetYaw = normalizeDegrees(relative);
                    const currentY = THREE.MathUtils.radToDeg(arrowGroupRef.current.rotation.y);
                    const delta = shortestAngleDelta(currentY, targetYaw);
                    const appliedDelta =
                        Math.abs(delta) < TURN_DEADBAND_DEG ? 0 : delta * ARROW_SMOOTHING;
                    arrowGroupRef.current.rotation.y = THREE.MathUtils.degToRad(
                        currentY + appliedDelta
                    );
                }

                const now = Date.now();
                if (now - lastDebugUpdate >= DEBUG_UPDATE_MS) {
                    lastDebugUpdate = now;
                    setDebug((current) => ({
                        ...current,
                        heading: heading.toFixed(1),
                        bearing: targetBearingRef.current.toFixed(1),
                        relative: relative.toFixed(1),
                    }));
                }
            }

            renderer.render(scene, camera);
        };

        renderer.setAnimationLoop(animate);

        return () => {
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
            }
            endWorldArSession();
            orientationListeners.forEach((eventName) => {
                window.removeEventListener(eventName, orientationHandler, true);
            });
            renderer.setAnimationLoop(null);
            if (renderer) {
                renderer.dispose();
            }
            stopFallbackVideo();
        };
    }, []);

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

            {xrAvailable && arMode !== "webxr" && (
                <button
                    onClick={() => startWorldArRef.current?.()}
                    style={{
                        position: "absolute",
                        top: 20,
                        right: 20,
                        zIndex: 10,
                        background: "rgba(15, 92, 42, 0.85)",
                        color: "white",
                        padding: "10px 20px",
                        borderRadius: "8px",
                        border: "none",
                    }}
                >
                    Enter World AR
                </button>
            )}

            {arMode === "webxr" && (
                <button
                    onClick={() => stopWorldArRef.current?.()}
                    style={{
                        position: "absolute",
                        top: 70,
                        right: 20,
                        zIndex: 10,
                        background: "rgba(0,0,0,0.6)",
                        color: "white",
                        padding: "10px 20px",
                        borderRadius: "8px",
                        border: "none",
                    }}
                >
                    Exit World AR
                </button>
            )}

            <div
                style={{
                    position: "absolute",
                    bottom: 140,
                    left: 20,
                    zIndex: 10,
                    background: "rgba(0,0,0,0.5)",
                    color: "white",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    maxWidth: "min(90vw, 360px)",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: "14px",
                }}
            >
                {arStatus}
            </div>

            <div
                style={{
                    position: "absolute",
                    bottom: 20,
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
            </div>
        </>
    );
};

export default ARView;
