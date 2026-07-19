"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StudentProfile } from "@/types/scholarship";

type StudentProfileState = {
  studentProfile: StudentProfile | null;
  setStudentProfile: (profile: StudentProfile) => void;
};

export const useStudentProfileStore = create<StudentProfileState>()(
  persist(
    (set) => ({
      studentProfile: null,
      setStudentProfile: (profile) => set({ studentProfile: profile }),
    }),
    {
      name: "skkolarship-student-profile",
    },
  ),
);

