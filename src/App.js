import React, { useState } from "react";
import Chatbot from "./components/Chatbot";
import NavigationButton from "./components/NavigationButton";
import ARView from "./components/ARView";

function App() {
  const [navigationTarget, setNavigationTarget] = useState(null);
  const [showAR, setShowAR] = useState(false);

  return (
      <div>
        {!showAR && (
            <>
              <Chatbot setNavigationTarget={setNavigationTarget} />
              <NavigationButton target={navigationTarget} onNavigate={() => setShowAR(true)} />
            </>
        )}
        {showAR && <ARView target={navigationTarget} />}
      </div>
  );
}

export default App;
