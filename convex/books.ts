import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import OpenAI from "openai";
import { Doc } from "./_generated/dataModel";

const openai = new OpenAI({
  baseURL: process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.CONVEX_OPENAI_API_KEY,
});

export const addBook = mutation({
  args: {
    title: v.string(),
    author: v.string(),
    rating: v.number(),
    genre: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const genre =
      args.genre ||
      (await ctx.scheduler.runAfter(0, api.books.detectGenre, {
        title: args.title,
        author: args.author,
      }));

    await ctx.db.insert("books", {
      userId,
      ...args,
      genre,
    });

    await ctx.scheduler.runAfter(0, api.books.generateRecommendations, {
      userId,
    });
  },
});

export const detectGenre = action({
  args: {
    title: v.string(),
    author: v.string(),
  },
  handler: async (ctx, args) => {
    const prompt = `What is the primary genre of the book "${args.title}" by ${args.author}? Respond with just a single word genre like "Fantasy", "Mystery", "Romance", etc.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [{ role: "user", content: prompt }],
    });

    return completion.choices[0].message.content?.trim() || "Fiction";
  },
});

export const searchBooks = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.query.length < 2) return [];

    const prompt = `Suggest up to 3 book titles and authors that match "${args.query}". Format as JSON like this:
{
  "suggestions": [
    {"title": "Book Title", "author": "Author Name"},
    {"title": "Another Book", "author": "Another Author"}
  ]
}
Only include real, well-known books.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    try {
      const result = JSON.parse(completion.choices[0].message.content!);
      return result.suggestions || [];
    } catch (error) {
      console.error("Failed to parse book suggestions:", error);
      return [];
    }
  },
});

export const listBooks = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getRecommendations = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("recommendations")
      .withIndex("by_user_recent", (q) => q.eq("userId", userId))
      .order("desc")
      .take(3);
  },
});

export const generateRecommendations = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const books = await ctx.runQuery(api.books.getUserBooks, {
      userId: args.userId,
    });
    if (books.length === 0) return;

    const prompt = `Based on these books and ratings:
${books.map((b: Doc<"books">) => `- "${b.title}" by ${b.author} (${b.genre || "Unknown"}) - rated ${b.rating}/5`).join("\n")}

Suggest 3 other books the reader might enjoy. Format as JSON like this:
{
  "suggestions": [
    {"title": "Book Title", "reason": "Brief reason"},
    {"title": "Another Book", "reason": "Another reason"}
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const recommendations = JSON.parse(completion.choices[0].message.content!);
    const timestamp = Date.now();

    for (const rec of recommendations.suggestions) {
      await ctx.runMutation(api.books.saveRecommendation, {
        userId: args.userId,
        bookTitle: rec.title,
        reason: rec.reason,
        timestamp,
      });
    }
  },
});

export const getUserBooks = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const saveRecommendation = mutation({
  args: {
    userId: v.id("users"),
    bookTitle: v.string(),
    reason: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("recommendations", args);
  },
});

export const removeBook = mutation({
  args: {
    bookId: v.id("books"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const book = await ctx.db.get(args.bookId);
    if (!book || book.userId !== userId) {
      throw new Error(
        "Book not found or you do not have permission to delete it"
      );
    }

    await ctx.db.delete(args.bookId);
  },
});

export const updateBook = mutation({
  args: {
    bookId: v.id("books"),
    title: v.string(),
    author: v.string(),
    rating: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const book = await ctx.db.get(args.bookId);
    if (!book || book.userId !== userId) {
      throw new Error(
        "Book not found or you do not have permission to edit it"
      );
    }

    await ctx.db.patch(args.bookId, {
      title: args.title,
      author: args.author,
      rating: args.rating,
    });
  },
});
