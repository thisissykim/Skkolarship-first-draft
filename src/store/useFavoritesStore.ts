"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type FavoritesState = {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  clearFavorites: () => void;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set) => ({
      favorites: [],
      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((item) => item !== id)
            : [...state.favorites, id],
        })),
      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: "skkolarship-favorites",
    },
  ),
);

