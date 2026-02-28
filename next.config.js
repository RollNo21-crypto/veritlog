/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
    // Required for Docker / ECS deployment — emits standalone server bundle
    output: "standalone",
};

export default config;
