import {
  Authenticated,
  Unauthenticated,
  useQuery,
  useMutation,
  useAction,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { SignOutButton } from "./SignOutButton";
import { useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import { Dialog } from "@headlessui/react";
import { SignInForm } from "./SignInForm";

type Book = {
  _id: string;
  title: string;
  author: string;
  rating: number;
  genre?: string;
};

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const handleClick = (index: number) => {
    onChange(index);
  };

  const handleMouseEnter = (index: number) => {
    setHoverValue(index);
  };

  const handleMouseLeave = () => {
    setHoverValue(null);
  };

  const renderStar = (index: number) => {
    const isFilled = hoverValue !== null ? hoverValue >= index : value >= index;

    return (
      <span
        key={index}
        className="cursor-pointer text-yellow-400"
        onClick={() => handleClick(index)}
        onMouseEnter={() => handleMouseEnter(index)}
        onMouseLeave={handleMouseLeave}
      >
        {isFilled ? "★" : "☆"}
      </span>
    );
  };

  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }, (_, i) => renderStar(i + 1))}
    </div>
  );
}

function EditBookModal({
  isOpen,
  onClose,
  book,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  book: { _id: Id<"books">; title: string; author: string; rating: number };
  onSave: (updatedBook: {
    title: string;
    author: string;
    rating: number;
  }) => void;
}) {
  const [updatedBook, setUpdatedBook] = useState({
    title: book.title,
    author: book.author,
    rating: book.rating,
  });

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-10">
      <div className="fixed inset-0 bg-black bg-opacity-25" />
      <div className="flex items-center justify-center min-h-screen">
        <Dialog.Panel className="bg-white p-6 rounded shadow-lg w-full max-w-md">
          <Dialog.Title className="text-lg font-semibold">
            Edit Book
          </Dialog.Title>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSave(updatedBook);
            }}
            className="flex flex-col gap-4 mt-4"
          >
            <input
              type="text"
              value={updatedBook.title}
              onChange={(e) =>
                setUpdatedBook((prev) => ({ ...prev, title: e.target.value }))
              }
              className="border p-2 rounded w-full"
              placeholder="Book Title"
              required
            />
            <input
              type="text"
              value={updatedBook.author}
              onChange={(e) =>
                setUpdatedBook((prev) => ({ ...prev, author: e.target.value }))
              }
              className="border p-2 rounded w-full"
              placeholder="Author"
              required
            />
            <div className="flex items-center gap-2">
              <label>Rating:</label>
              <StarRating
                value={updatedBook.rating}
                onChange={(value) =>
                  setUpdatedBook((prev) => ({ ...prev, rating: value }))
                }
              />
              <span>{updatedBook.rating}/5</span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-500 text-white py-2 px-4 rounded hover:bg-indigo-600"
              >
                Save
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm p-4 flex justify-between items-center border-b">
        <h2 className="text-xl font-semibold accent-text">BookBrain</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <Content />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const books = useQuery(api.books.listBooks);
  const recommendations = useQuery(api.books.getRecommendations);
  const addBook = useMutation(api.books.addBook);
  const removeBook = useMutation(api.books.removeBook);
  const searchBooks = useAction(api.books.searchBooks);
  const updateBook = useMutation(api.books.updateBook);
  const generateRecommendations = useAction(api.books.generateRecommendations);
  const [editingBook, setEditingBook] = useState<{
    _id: Id<"books">;
    title: string;
    author: string;
    rating: number;
  } | null>(null);

  const [newBook, setNewBook] = useState({
    title: "",
    author: "",
    rating: 5,
  });

  const [suggestions, setSuggestions] = useState<
    Array<{ title: string; author: string }>
  >([]);
  const [searchTimeout, setSearchTimeout] = useState<number | null>(null);

  useEffect(() => {
    if (newBook.title.length >= 2) {
      if (searchTimeout) {
        window.clearTimeout(searchTimeout);
      }
      const timeout = window.setTimeout(async () => {
        const results = await searchBooks({ query: newBook.title });
        setSuggestions(results || []);
      }, 300);
      setSearchTimeout(timeout);
    } else {
      setSuggestions([]);
    }
  }, [newBook.title, searchBooks]);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addBook(newBook);
      setNewBook({ title: "", author: "", rating: 5 });
      setSuggestions([]);
      toast.success("Book added successfully!");
    } catch (error) {
      toast.error("Failed to add book");
    }
  };

  const handleSuggestionClick = (suggestion: {
    title: string;
    author: string;
  }) => {
    setNewBook((prev) => ({
      ...prev,
      title: suggestion.title,
      author: suggestion.author,
    }));
    setSuggestions([]);
  };

  const handleEditSave = async (updatedBook: {
    title: string;
    author: string;
    rating: number;
  }) => {
    if (!editingBook) return; // Ensure editingBook is not null

    try {
      await updateBook({
        bookId: editingBook._id as Id<"books">,
        ...updatedBook,
      });
      setEditingBook(null);
      toast.success("Book updated successfully!");
    } catch (error) {
      toast.error("Failed to update book");
    }
  };

  const handleGenerateRecommendations = async () => {
    try {
      if (loggedInUser) {
        await generateRecommendations({ userId: loggedInUser._id });
      } else {
        toast.error("User not logged in");
      }
      toast.success("Recommendations generated successfully!");
    } catch (error) {
      toast.error("Failed to generate recommendations");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold accent-text mb-4">BookBrain</h1>
        <Authenticated>
          <p className="text-xl text-slate-600">
            Your Personal Book Recommendation Engine
          </p>
        </Authenticated>
        <Unauthenticated>
          <p className="text-xl text-slate-600">Sign in to get started</p>
        </Unauthenticated>
      </div>

      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>

      <Authenticated>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Add a Book</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Book Title"
                  value={newBook.title}
                  onChange={(e) =>
                    setNewBook((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="border p-2 rounded w-full"
                  required
                />
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border rounded-b shadow-lg mt-1 z-10">
                    {suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full text-left p-2 hover:bg-slate-100"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <div className="font-medium">{suggestion.title}</div>
                        <div className="text-sm text-slate-600">
                          by {suggestion.author}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="Author"
                value={newBook.author}
                onChange={(e) =>
                  setNewBook((prev) => ({ ...prev, author: e.target.value }))
                }
                className="border p-2 rounded"
                required
              />
              <div className="flex items-center gap-2">
                <label>Rating:</label>
                <StarRating
                  value={newBook.rating}
                  onChange={(value) =>
                    setNewBook((prev) => ({ ...prev, rating: value }))
                  }
                />
                <span>{newBook.rating}/5</span>
              </div>
              <button
                type="submit"
                className="bg-indigo-500 text-white py-2 px-4 rounded hover:bg-indigo-600"
              >
                Add Book
              </button>
            </form>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">Your Books</h2>
            <div className="space-y-4">
              {books?.map((book) => (
                <div key={book._id} className="border p-4 rounded">
                  <h3 className="font-semibold">{book.title}</h3>
                  <p className="text-sm text-slate-600">
                    by {book.author} • {book.genre || "Detecting genre..."}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className="text-yellow-400">
                        {book.rating >= i + 1 ? "★" : "☆"}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() => setEditingBook(book)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-500 hover:underline"
                      onClick={() => void removeBook({ bookId: book._id })}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="mt-4 bg-indigo-500 text-white py-2 px-4 rounded hover:bg-indigo-600"
              onClick={handleGenerateRecommendations}
            >
              Generate Recommendations
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Recommended for You</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {recommendations?.map((rec) => (
              <div key={rec._id} className="border p-4 rounded bg-indigo-50">
                <h3 className="font-semibold">{rec.bookTitle}</h3>
                <p className="text-sm text-slate-600 mt-2">{rec.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </Authenticated>
      {editingBook && (
        <EditBookModal
          isOpen={!!editingBook}
          onClose={() => setEditingBook(null)}
          book={editingBook}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
