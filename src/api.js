import axios from "axios";

const API_BASE = "http://localhost:8080/api";

export const sendQuery = async (message) => {
    // Send user query to backend to get intent & entity
    const response = await axios.post(`${API_BASE}/query`, { message });
    return response.data; // { intent: "navigate", entity: "ECE Block" }
};

export const getPath = async (from, to) => {
    const response = await axios.post(`${API_BASE}/navigate`, { from, to });
    return response.data; // [[lat, lon], [lat, lon], ...]
};
