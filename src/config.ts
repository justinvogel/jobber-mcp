import "dotenv/config";
import path from "node:path";

const required = (name: string, value: string | undefined): string => {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill in your Jobber OAuth credentials.`,
    );
  }
  return value;
};

export const config = {
  clientId: process.env.JOBBER_CLIENT_ID ?? "",
  clientSecret: process.env.JOBBER_CLIENT_SECRET ?? "",
  redirectUri: process.env.JOBBER_REDIRECT_URI ?? "http://localhost:8976/callback",
  apiVersion: process.env.JOBBER_API_VERSION ?? "2025-01-20",
  tokenFile: path.resolve(
    process.env.JOBBER_TOKEN_FILE ?? path.join(process.cwd(), ".jobber-tokens.json"),
  ),
  scopes: process.env.JOBBER_SCOPES?.trim() || undefined,
  endpoints: {
    graphql: "https://api.getjobber.com/api/graphql",
    authorize: "https://api.getjobber.com/api/oauth/authorize",
    token: "https://api.getjobber.com/api/oauth/token",
  },
};

export const assertCredentials = (): void => {
  required("JOBBER_CLIENT_ID", config.clientId);
  required("JOBBER_CLIENT_SECRET", config.clientSecret);
};
