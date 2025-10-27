import React, { useState } from "react";
import Chatbot from "./components/Chatbot";
import ARView from "./components/ARView";

function App() {
    const [showAR, setShowAR] = useState(false);
    const [path, setPath] = useState(null);

    return (
        <div style={{ height: "100vh", width: "100vw", overflow: "hidden" }}>
            {showAR ? (
                <div style={{ position: "relative", height: "100%", width: "100%" }}>
                    {/* AR View */}
                    <ARView path={path} />

                    {/* Back to Chat Button */}
                    <button
                        onClick={() => setShowAR(false)}
                        style={{
                            position: "absolute",
                            top: "20px",
                            left: "20px",
                            background: "#4CAF50",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            padding: "10px 15px",
                            cursor: "pointer",
                            fontFamily: "Poppins, sans-serif",
                            boxShadow: "0 0 10px rgba(0,0,0,0.4)",
                            transition: "0.3s ease",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "#45a049")}
                        onMouseOut={(e) => (e.currentTarget.style.background = "#4CAF50")}
                    >
                        ← Back to Chat
                    </button>
                </div>
            ) : (
                <Chatbot setShowAR={setShowAR} setPath={setPath} />
            )}
        </div>
    );
}

export default App;

