import axios from "axios";
import { BASE_URL } from "./config";

export const sendQuery = async (message, latitude = null, longitude = null) => {
    const payload = { message };
    if (latitude !== null && longitude !== null) {
        payload.latitude = latitude;
        payload.longitude = longitude;
    }
    const response = await axios.post(`${BASE_URL}/chat`, payload);
    return response.data;
};

export const getPath = async (from, to) => {
    const response = await axios.post(`${BASE_URL}/navigation/path`, {
        source: from,
        destination: to,
    });
    return response.data;
};

export const getNodes = async () => {
    const response = await axios.get(`${BASE_URL}/nodes`);
    return response.data;
};
