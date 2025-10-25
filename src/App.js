import React, { useState } from "react";
import Chatbot from "./Chatbot";
import ARView from "./ARView";

function App() {
    const [showAR, setShowAR] = useState(false);
    const [path, setPath] = useState([]);

    return (
        <div>
            {!showAR ? (
                <Chatbot setShowAR={setShowAR} setPath={setPath} />
            ) : (
                <ARView path={path} />
            )}
        </div>
    );
}

export default App;
