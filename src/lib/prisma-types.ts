// Re-export everything from the generated Prisma client
export * from "@/generated/prisma";

// SQLite doesn't support native enums, so we define string literal types
// that match the values used throughout the application
export type MessageRole = "USER" | "ASSISTANT";
export type MessageType = "RESULT" | "ERROR";
