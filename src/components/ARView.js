import React, { useEffect } from "react";

function ARView({ pathData }) {
    useEffect(() => {
        console.log("AR path data:", pathData);

        // Example: you can loop through edges and render arrows using AR.js
        // For now we just log it; later integrate AR.js scene
    }, [pathData]);

    return (
        <div style={{ marginTop: "20px" }}>
            <h3>AR View (Camera + arrows)</h3>
            <div id="ar-container" style={{ width: "100%", height: "400px", backgroundColor: "#000" }}>
                {/* AR.js camera + arrows will be rendered here */}
            </div>
        </div>
    );
}

export default ARView;
