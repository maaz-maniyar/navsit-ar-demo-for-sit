import React from "react";

export default function NavigationButton({ target, onNavigate }) {
    if (!target) return null;

    return (
        <div style={{ marginTop: 10 }}>
            <button onClick={() => onNavigate(target)}>Navigate to {target}</button>
        </div>
    );
}
