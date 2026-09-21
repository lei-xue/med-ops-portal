import { config } from "dotenv";

// Point the whole vitest process at the dockerized test database.
config({ path: ".env.test", override: true });
