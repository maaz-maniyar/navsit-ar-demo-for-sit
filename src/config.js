const DEFAULT_BACKEND_ORIGIN = "https://navsit-backend.onrender.com";

export const BACKEND_ORIGIN =
    process.env.REACT_APP_BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN;

export const BASE_URL = `${BACKEND_ORIGIN}/api`;

