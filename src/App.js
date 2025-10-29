import React, { useState } from "react";
import Chatbot from "./components/Chatbot";
import ARView from "./components/ARView";

function App() {
    const [showAR, setShowAR] = useState(false);
    const [nextNodeCoords, setNextNodeCoords] = useState(null);

    return (
        <div style={{ height: "100vh", width: "100vw", overflow: "hidden" }}>
            {showAR ? (
                <ARView
                    nextNodeCoords={nextNodeCoords}
                    onBack={() => {
                        setShowAR(false);
                        setNextNodeCoords(null);
                    }}
                />
            ) : (
                <Chatbot
                    setShowAR={setShowAR}
                    setNextNodeCoords={setNextNodeCoords} // 👈 make sure this line exists
                />
            )}
        </div>
    );
}

export default App;
