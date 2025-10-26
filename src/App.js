import React, { useState } from "react";
import Chatbot from "./components/Chatbot";
import ARView from "./components/ARView";
import { motion, AnimatePresence } from "framer-motion";

function App() {
    const [showAR, setShowAR] = useState(false);
    const [path, setPath] = useState([]);

    return (
        <div style={styles.appContainer}>
            <AnimatePresence mode="wait">
                {!showAR ? (
                    <motion.div
                        key="chatbot"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.4 }}
                        style={styles.fullscreen}
                    >
                        <Chatbot setShowAR={setShowAR} setPath={setPath} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="arview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        style={styles.fullscreen}
                    >
                        <ARView path={path} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const styles = {
    appContainer: {
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#0f172a", // fallback before ARView video loads
    },
    fullscreen: {
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
    },
};

export default App;
