import React, { useState } from "react";
import Chatbot from "./components/Chatbot";
import ARView from "./components/ARView";

function App() {
    const [showAR, setShowAR] = useState(false);
    const [navData, setNavData] = useState(null); // { nextCoords: {lat,lng}, path, nextNode }

    const handleNavigationStart = (navPayload) => {
        // navPayload: { nextCoords: { lat, lng }, path, nextNode, reply }
        setNavData(navPayload);
        setShowAR(true);
    };

    return (
        <div style={{ height: "100vh", width: "100vw", overflow: "hidden" }}>
            {showAR ? (
                <ARView
                    nextNodeCoords={navData?.nextCoords}
                    path={navData?.path}
                    onBack={() => {
                        setShowAR(false);
                        setNavData(null);
                    }}
                />
            ) : (
                <Chatbot onNavigationStart={handleNavigationStart} />
            )}
        </div>
    );
}

export default App;
