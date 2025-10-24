import React, { useState } from "react";
import Chatbot from "./components/Chatbot";
import ARView from "./components/ARView";

function App() {
    const [showAR, setShowAR] = useState(false);
    const [path, setPath] = useState([]);

    return (
        <div>
            {!showAR ? (
                <Chatbot
                    setShowAR={setShowAR}
                    setPath={setPath}
                />
            ) : (
                <ARView path={path} />
            )}
        </div>
    );
}

export default App;
