import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  books: defineTable({
    userId: v.id("users"),
    title: v.string(),
    author: v.string(),
    rating: v.number(),
    genre: v.optional(v.string()),
  }).index("by_user", ["userId"]),
  recommendations: defineTable({
    userId: v.id("users"),
    bookTitle: v.string(),
    reason: v.string(),
    timestamp: v.number(),
  }).index("by_user_recent", ["userId", "timestamp"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
